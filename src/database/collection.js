const { EventEmitter } = require("events");
const createFilter = require("./filter");
const createOrderBy = require("./order");
const createLimit = require("./limit");
const updateValue = require("./update_value");
const { clean, flatten, validCollection, inbuiltProps } = require("./props");
const { LRUCache } = require("lru-cache");
const rules = require("./rules");

const crypto = require("crypto");
const { getDB } = require("./db");
let algorithm = "aes-256-cbc";
let key = crypto.randomBytes(32);
let iv = crypto.randomBytes(16);

function encrypt(str) {
  let cipher = crypto.createCipheriv(algorithm, key, iv);
  return cipher.update(str, "utf8", "base64") + cipher.final("base64");
}

function decrypt(str) {
  let decipher = crypto.createDecipheriv(algorithm, key, iv);
  return decipher.update(str, "base64", "utf8") + decipher.final("utf8");
}

const cache = new LRUCache({
  sizeCalculation(value, key) {
    return key.length;
  },
  maxSize: 5000,
});
function prepare(stmt) {
  if (cache.has(stmt)) return cache.get(stmt);
  else {
    console.log(stmt);
    console.log(
      getDB()
        .prepare("EXPLAIN QUERY PLAN " + stmt)
        .all(
          ...stmt
            .split("?")
            .slice(1)
            .map(() => "")
        )
    );
    const x = getDB().prepare(stmt);
    cache.set(stmt, x);
    return x;
  }
}
/**
 * @type {Record<string, Collection}
 */
const _collections = {};
/** TODO use lru cache */
class Collection extends EventEmitter {
  name = "";
  knownColumns = [];
  oplog = "";
  static of(name) {
    if (_collections[name]) return _collections[name];
    return (_collections[name] = new Collection(name));
  }

  constructor(name) {
    super();
    if (!validCollection(name)) throw new Error("Invalid collection " + name);
    this.name = name.replace(/\//g, "___");
    this.oplog = "___" + name + "_logs___";
    prepare(
      `CREATE TABLE IF NOT EXISTS ${this.name} (
__id__ TEXT PRIMARY KEY NOT NULL,
__version__ INTEGER
);`
    ).run();
    prepare(
      `CREATE TABLE IF NOT EXISTS ${this.oplog} (
__index__ INTEGER PRIMARY KEY AUTOINCREMENT,
__id__ TEXT KEY NOT NULL
);`
    ).run();
    this._listColumns();
    this.dropEmptyColumns();
  }
  _listColumns() {
    /** When doing read replication, we want to make sure changes to columns also trigger recreation of knownColumns.
            The advantage of better-sqlite3 synchronous API is obvious here.
        In a distributed database, knownColumns cannot be cached.
    */
    return this.knownColumns.length
      ? this.knownColumns
      : (this.knownColumns = getDB()
          .prepare(`select name from pragma_table_info(?)`)
          .all(this.name)
          .map((e) => clean(e.name)));
  }
  _select(query, count) {
    console.log({ query });
    if (!query) query = {};
    query = {
      ...query,
      filter: {
        prop: "__version__",
        op: "!=",
        val: null,
        next: query.filter,
        nextType: "AND",
      },
      order: query.order || {
        props: ["rowid"],
        desc: ["asc"],
      },
    };
    return getDB().transaction(() => {
      const cols = this._listColumns();
      const t = createFilter(cols, query.filter).compile();
      const o = createOrderBy(
        cols,
        query.order || {
          props: ["rowid"],
          desc: ["asc"],
        }
      );
      const v = createLimit(o, query.limit).compile();
      const n = o.compile(); //Must happen after to get reversed flag set
      t.sql += n.sql + v.sql;
      t.args = [...t.args, ...n.args, ...v.args];
      let compiled = `SELECT * FROM ${this.name} ${t.sql}`;
      if (count) {
        compiled = "SELECT count(*) as ___count__ FROM(" + compiled + ")";
      }
      const x = prepare(compiled);
      const res = x.raw().all(t.args);
      if (o.reversed) res.reverse();
      return { rows: res, columns: x.columns().map((e) => e.name) };
    })();
  }
  get(query) {
    return this._select(query, false);
  }
  count(query) {
    return this._select(query, true);
  }
  set(data, conditions = {}) {
    if (!data.__id__) throw new Error("No id provided");
    const flat = flatten(data);
    this.createColumns(Object.keys(flat));
    const keys = Object.keys(flat);
    /**
         * @type {{
             sql: string,
             sqlCreate?: string,
             args: any[],
             argsCreate?: any[]
         }[]}
         */
    const placeholders = keys.map(function (key) {
      let e = flat[key];
      if (e && typeof e === "object" && e.__isUpdateValue__) {
        return updateValue(clean(key), e);
      } else {
        return inbuiltProps[key]
          ? {
              sql:
                key === "__version__" && data.__version__ != null
                  ? `max(?, ${key} + 1)`
                  : "?",
              sqlCreate: "?",
              args: [e],
            }
          : {
              sql: "json(?)",
              args: [JSON.stringify(e)],
            };
      }
    });
    const create = conditions.exists !== true && {
      sql: `INSERT INTO ${this.name} (${keys
        .map(clean)
        .join(", ")}) VALUES (${keys.map(
        (e, i) => placeholders[i].sqlCreate || placeholders[i].sql
      )})`,
      args: placeholders.map((e) => e.argsCreate || e.args).flat(),
    };

    // TODO: Here we update id twice unnecessarily
    const update = conditions.exists !== false && {
      sql: `UPDATE SET ${keys.map(
        (e, i) => `${clean(e)}   = ${placeholders[i].sql}`
      )} WHERE __version__ IS NOT NULL`,
      args: placeholders.map((e) => e.args).flat(),
    };

    const query = create
      ? update
        ? create.sql + " ON CONFLICT DO " + update.sql
        : create.sql
      : update
      ? "UPDATE " + this.name + update.sql.slice(6) + " AND __id__ = ?"
      : "";
    const args = create
      ? update
        ? [...create.args, ...update.args]
        : create.args
      : update
      ? [...update.args, flat.__id__]
      : [];
    getDB().transaction(() => {
      const res = prepare(query).run(...args);
      if (!res.changes) {
        if (
          !(
            create &&
            this.remove(data) &&
            prepare(create.sql).run(create.args).changes > 0
          )
        ) {
          throw new Error("Write failed for " + data.__id__);
        }
      }

      prepare(`INSERT INTO ${this.oplog} (__id__) VALUES (?)`).run(flat.__id__);
    })();
  }
  delete(data, conditions = {}) {
    try {
      this.set(
        {
          __id__: data.__id__,
          __version__: null,
        },
        { exists: true }
      );
      return true;
    } catch (e) {
      if (e.message === "Failed to run set" && !conditions.exists) {
        return false;
      }
    }
  }
  remove(data) {
    if (!data.__id__) throw new Error("No id provided");
    return (
      prepare(`DELETE FROM ${this.name} WHERE __id__ == ?`).run(data.__id__)
        .changes > 0
    );
  }
  poll(cursor, query) {
    const BACKLOG_LIMIT = 25;
    let docs,
      newIds = null,
      oldIds = null,
      newCursor;
    if (cursor) {
      let obj;
      try {
        obj = JSON.parse(decrypt(cursor));
      } catch (e) {
        console.error(e);
        return this.poll(null, query);
      }
      const { index, ids } = obj;
      oldIds = ids;
      const isValid = prepare(
        `SELECT TRUE  FROM ${this.oplog} WHERE __index__ == ?`
      )
        .pluck()
        .get(index);
      const changes =
        isValid &&
        prepare(
          `SELECT __id__, MAX(__index__) AS _index FROM ${
            this.oplog
          } WHERE __index__ > ? GROUP BY __id__
                ORDER BY _index ASC
                LIMIT ${oldIds ? BACKLOG_LIMIT : 1}` //Rather than iterate through changes, just check if anything changed
        ).all(index);
      if (!isValid || changes.length !== 0) {
        newIds =
          changes.length < BACKLOG_LIMIT &&
          isValid &&
          changes.map((e) => e.__id__);
        // Oplog has been recycled,

        newCursor = changes[changes.length - 1];
        docs = this.get(query);
      }
    } else {
      docs = this.get(query);
      newCursor = prepare(
        `SELECT MAX(__index__) AS _index FROM ${this.oplog}`
      ).get();
    }
    // TODO: this is not actually efficient in that we send the ids twice
    const ID = docs && docs.columns.indexOf("__id__");

    let cursorStr = newCursor
      ? encrypt(
          JSON.stringify({
            index: newCursor._index,
            ids: docs.rows.length < 50 ? docs.rows.map((e) => e[ID]) : null,
          })
        )
      : true;
    let rows =
      docs &&
      docs.rows.map((e) =>
        //If we know all the old ids and all the changed ids, we can limit our query a bit
        oldIds &&
        newIds &&
        oldIds.indexOf(e[ID]) > -1 &&
        newIds.indexOf(e[ID]) < 0
          ? e[ID]
          : e
      );
    if (docs && !rows.some((e) => typeof e !== "string")) rows = undefined;
    console.log({ cursorStr });
    return {
      columns: rows && docs.columns,
      rows,
      cursor: cursorStr,
    };
  }
  createColumns(cols) {
    cols = cols.filter((col) => {
      return this.knownColumns.indexOf(clean(col)) < 0;
    });
    for (let col of cols) {
      try {
        let prefix = clean(col);
        if (prefix[0] === '"') {
          prefix = JSON.parse(prefix);
        }
        getDB().transaction(() => {
          getDB()
            .prepare(
              `ALTER TABLE ${this.name} ADD COLUMN ${clean(col)} JSON
            `
            )
            .run();

          // Used for binary queries
          getDB()
            .prepare(
              `CREATE INDEX IF NOT EXISTS ${clean(prefix + "idx___")} ON ${
                this.name
              } (json_extract(${clean(col)}, '$'))`
            )
            .run();
        })();
        this.knownColumns.push(clean(col));
      } catch (e) {
        if (e.code === "SQLITE_ERROR" && /duplicate column/.test(e.message)) {
          this.knownColumns.push(clean(col));
          continue;
        }
        throw e;
      }
    }
  }
  dropEmptyColumns() {
    let update = false;
    for (let col of this.knownColumns) {
      if (!inbuiltProps[col])
        getDB()
          .transaction(() => {
            if (
              getDB()
                .prepare(
                  `SELECT 1 from ${this.name} where ${col} IS NOT NULL LIMIT 1`
                )
                .raw()
                .all().length === 0
            ) {
              update = true;
              getDB()
                .prepare(`ALTER TABLE ${this.name} DROP COLUMN ${col}`)
                .run();
            }
          })
          .immediate();
    }
    if (update) {
      this.knownColumns = [];
    }
  }
}

module.exports = Collection;
