import { EventEmitter } from "events";
import createFilter from "./filter.js";
import createOrderBy from "./order.js";
import createLimit from "./limit.js";
import updateValue from "./update_value.js";
import { clean, flatten, validCollection, inbuiltProps } from "./props.js";

import rules from "./rules.js";

import {
  dbExecute,
  dbAll,
  dbRaw,
  dbGet,
  dbBatch,
  dbTransaction,
} from "./db.js";

const subtleCrypto = globalThis.crypto.subtle;
let key = await subtleCrypto.generateKey(
  {
    name: "AES-GCM",
    length: 256,
  },
  true,
  ["encrypt", "decrypt"]
);
let iv = globalThis.crypto.getRandomValues(new Uint16Array(32));

async function encrypt(str) {
  await subtleCrypto.encrypt(
    {
      name: "AES-CBC",
      iv,
    },
    key,
    str
  );
}

async function decrypt(str) {
  await subtleCrypto.decrypt(
    {
      iv,
      name: "AES-CBC",
    },
    key,
    str
  );
}

/**
 * @type {Record<string, Collection}
 */
const _collections = {};
/** TODO use lru cache */
class Collection extends EventEmitter {
  name = "";
  oplog = "";
  dbInit = null;
  static of(name) {
    if (_collections[name]) return _collections[name];
    return (_collections[name] = new Collection(name));
  }

  constructor(name) {
    super();
    if (!validCollection(name)) throw new Error("Invalid collection " + name);
    this.name = name.replace(/\//g, "___");
    this.oplog = "___" + name + "_logs___";
    this.dbInit = dbExecute(
      `CREATE TABLE IF NOT EXISTS ${this.name} (
__id__ TEXT PRIMARY KEY NOT NULL,
__version__ INTEGER
);
      CREATE TABLE IF NOT EXISTS ${this.oplog} (
__index__ INTEGER PRIMARY KEY AUTOINCREMENT,
__id__ TEXT KEY NOT NULL
);`
    );
    this._listColumns();
    // Rather we schedule cleanups using a different table
    // this.dropEmptyColumns();
    // If someone tried to read a column that had been deleted, it would error.
    // But only until the faulty worker was updated.
    // To ensure this, when we drop columns, we should also clear cached queries.
  }

  async _listColumns() {
    /** When doing read replication, we want to make sure changes to columns also trigger recreation of knownColumns.
            The advantage of better-sqlite3 synchronous API is obvious here.
        In a distributed database, knownColumns cannot be cached.
    */
    return await dbAll(`SELECT name FROM pragma_table_info(?)`, [this.name], {
      batch: true,
    });
  }
  async _select(query, count) {
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

    const cols = await this._listColumns();
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
    const res = await dbRaw(compiled, t.args);
    if (o.reversed) res.reverse();
    // The implementation of createFilter is such that this will never return items that were not in the columns it specified.
    // Except where such columns are undefined or null.
    return { rows: res, columns: cols };
  }

  async get(query) {
    return await this._select(query, false);
  }
  async count(query) {
    return await this._select(query, true);
  }

  async poll(cursor, query) {
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
      const changes = await dbAll(
        `SELECT __id__, MAX(__index__) AS _index FROM ${
          this.oplog
        } WHERE __index__ >= ? GROUP BY __id__
                ORDER BY _index ASC
                LIMIT ${oldIds ? BACKLOG_LIMIT : 1}`, //Rather than iterate through changes, just check if anything changed
        [index]
      );
      const isValid = changes.pop()._index === index;
      if (!isValid || changes.length !== 0) {
        newIds =
          changes.length < BACKLOG_LIMIT &&
          isValid &&
          changes.map((e) => e.__id__);
        // Oplog has been recycled,

        newCursor = changes[changes.length - 1];
        docs = await this.get(query);
      }
    } else {
      docs = this.get(query);
      newCursor = await dbGet(
        `SELECT MAX(__index__) AS _index FROM ${this.oplog}`
      );
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

  // WRITES
  async _prepareSet(data, conditions = {}) {
    if (!data.__id__) throw new Error("No id provided");
    const flat = flatten(data);
    const keys = Object.keys(flat);

    /**
     * @type {{
     *     sql: string,
     *     sqlCreate?: string,
     *     args: any[],
     *     argsCreate?: any[]
     * }[]}
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

    // CREATE QUERY TO INSERT INTO DATABASE
    const create = conditions.exists !== true && {
      sql: `INSERT INTO ${this.name} (${keys
        .map(clean)
        .join(", ")}) VALUES (${keys.map(
        (e, i) => placeholders[i].sqlCreate || placeholders[i].sql
      )})`,
      args: placeholders.map((e) => e.argsCreate || e.args).flat(),
    };

    // CREATE QUERY TO UPDATE INTO DATABASE
    const update = conditions.exists !== false && {
      sql: `UPDATE SET ${keys.map(
        (e, i) => `${clean(e)}   = ${placeholders[i].sql}`
      )} WHERE __version__ IS NOT NULL`,
      args: placeholders.map((e) => e.args).flat(),
    };

    // JOIN QUERIES BASED ON CONDITIONS
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
    return [
      ...this._prepareColumns(Object.keys(flat)),
      typeof conditions.exists !== false && {
        sql: "DELETE FROM test WHERE __id__ = ? AND __version__ IS NULL",
        args: [data.__id__],
      },
      { sql: query, args },
      {
        sql: `INSERT INTO ${this.oplog} (__id__) SELECT ? WHERE (SELECT changes() = 0)`,
        args: [data.__id__],
      },
    ];
  }
  async set(data, conditions) {
    return await dbBatch(this._prepareSet(data, conditions));
  }
  async delete(data, conditions = {}) {
    try {
      await this.set(
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
  async remove(data) {
    if (!data.__id__) throw new Error("No id provided");
    return (
      (
        await dbExecute(`DELETE FROM ${this.name} WHERE __id__ == ?`, [
          data.__id__,
        ])
      ).rowsAffected > 0
    );
  }
  _prepareColumns(cols) {
    const sql = [];
    cols = cols.filter((col) => {
      return this.knownColumns.indexOf(clean(col)) < 0;
    });
    for (let col of cols) {
      try {
        let prefix = clean(col);
        if (prefix[0] === '"') {
          prefix = JSON.parse(prefix);
        }
        sql.push(
          `ALTER TABLE ${this.name} ADD COLUMN ${clean(col)} JSON
            `
        );
        sql.push(
          `CREATE INDEX IF NOT EXISTS ${clean(prefix + "idx___")} ON ${
            this.name
          } (json_extract(${clean(col)}, '$'))`
        );
        this.knownColumns.push(clean(col));
      } catch (e) {
        if (e.code === "SQLITE_ERROR" && /duplicate column/.test(e.message)) {
          this.knownColumns.push(clean(col));
          continue;
        }
        throw e;
      }
    }
    return { sql, args: [] };
  }
  async dropEmptyColumns() {
    let update = false;
    await dbTransaction(async (txn) => {
      for (let col of this.knownColumns) {
        if (!inbuiltProps[col]) {
          const res = await txn.execute(
            `SELECT 1 from ${this.name} where ${col} IS NOT NULL LIMIT 1`
          );
          if (res.rows.length > 0) {
            await txn.execute(`ALTER TABLE ${this.name} DROP COLUMN ${col}`);
          }
        }
      }
    });
    if (update) {
      this.knownColumns = [];
    }
  }
}

export default Collection;
