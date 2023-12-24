import * as props from "./props";
import { v4 as uuidv4 } from "uuid";

export function getAirstore(root, app) {
  return {
    async api(path, method = "GET", body = "") {
      return await (
        await fetch(root + path, {
          body: method !== "GET" ? JSON.stringify(body || {}) : undefined,
          headers: {
            authorization:
              app.auth && app.auth.currentUser
                ? await app.auth.currentUser
                    .getIdToken(/* forceRefresh */ true)
                    .catch(function (error) {
                      // Handle error
                      console.error(error);
                    })
                : null,
            "Content-Type": "application/json",
          },
          method,
        })
      ).json();
    },
  };
}
export function ref(path, airstore) {
  return {
    path,
    id: path.split("/").pop(),
    airstore,
    /** @type {any} */
    _parent: null,
    get parent() {
      return (
        this._parent ||
        (this._parent = ref(path.slice(0, -this.id.length - 1), airstore))
      );
    },
  };
}
export function collection(...path) {
  let airstore = typeof path[0] == "object" ? path.shift() : null;
  const m = path.join("/");
  if (m.split("/").length % 2 !== 1)
    throw new Error("Wrong number of segments in collection");
  if (!props.validCollection(m)) throw new Error("Invalid path " + path);
  return ref(m, airstore);
}

export function doc(...path) {
  let airstore;
  if (typeof path[0] == "object") {
    if (path[0].api) {
      airstore = path.shift();
    } else if (path[0].airstore) {
      airstore = path[0].airstore;
      path[0] = path[0].path;
      if (path.length === 1) path.push(uuidv4().replace(/\-/g, ""));
    } else throw new Error("Invalid path: " + path);
  }
  console.log(path);
  const m = path.join("/") ?? uuidv4().replace(/\-/g, "");
  if (m.split("/").length % 2 !== 0)
    throw new Error("Wrong number of segments in doc");
  return ref(m, airstore);
}

export function refEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}
export function queryEqual(a, b) {
  return refEqual(a, b);
}

async function mutateDoc(ref, url, method, data) {
  try {
    return await ref.airstore.api(url, method, data);
  } finally {
    const s = localUpdates[ref.parent.path];
    if (s) {
      s.forEach((e) => e());
    }
  }
}
export async function deleteDoc(ref) {
  return await mutateDoc(
    ref,
    "/delete/" +
      encodeURIComponent(ref.parent.path) +
      "/" +
      encodeURIComponent(ref.id),
    "POST"
  );
}
export async function setDoc(ref, data, opts) {
  if (!opts || !opts.merge) throw new Error("merge must be true");
  return await mutateDoc(
    ref,
    "/set/" +
      encodeURIComponent(ref.parent.path) +
      "/" +
      encodeURIComponent(ref.id) +
      "?create&update",
    "POST",
    data
  );
}
export async function addDoc(ref) {
  return await mutateDoc(
    doc(ref),
    "/set/" +
      encodeURIComponent(ref.parent.path) +
      "/" +
      encodeURIComponent(ref.id) +
      "?create",
    "POST"
  );
}
export async function updateDoc(ref, data) {
  return await mutateDoc(
    ref,
    "/set/" +
      encodeURIComponent(ref.parent.path) +
      "/" +
      encodeURIComponent(ref.id) +
      "?update",
    "POST",
    data
  );
}

export function query(ref, ...specs) {
  const t = {};
  for (let spec of specs) {
    if (spec.order) {
      if (!t.order) {
        t.order = { props: [...spec.order.props], desc: [...spec.order.desc] };
      } else {
        t.order.props.push(...spec.order.props);
        t.order.desc.push(...spec.order.desc);
      }
    }
    if (spec.limit !== undefined) {
      if (t.limit !== undefined) throw new Error("Duplicate limit clause");
      t.limit = spec.limit;
    }
  }
  for (let spec of specs) {
    if (spec.cursor) {
      for (let i = 0; i < spec.cursor.length; i++) {
        specs.push({
          filter: {
            prop:
              typeof spec.cursor[i] === "object"
                ? documentId()
                : t.order.props[i],
            op: spec.op,
            val: spec.cursor[i],
          },
        });
      }
    }
  }
  for (let spec of specs) {
    if (spec.filter) {
      if (t.filter && !t.filter.next) t.filter.next = spec.filter;
      else if (!t.filter || !spec.next) {
        t.filter = { ...spec.filter, next: t.filter };
      } else {
        t.filter = {
          val: t.filter,
          next: spec.filter,
        };
      }
    }
  }
  return {
    query: t,
    converter: undefined,
    withConverter(converter) {
      return { ...this, converter };
    },
    ref,
  };
}
class DocumentSnapshot {
  constructor(ref, conv, data, columns) {
    this.ref = ref;
    this._conv = conv;
    this._data = data;
    this.columns = columns;
  }
  data(options) {
    if (!options && this._conv) return this._conv.fromFirestore(this, {});
    if (!this._data) return;
    return props.unflatten(this._data, this.columns);
  }
  exists() {
    return !!this._data;
  }
  get(prop) {
    return this._data[this.columns.indexOf(props.clean(prop))];
  }
  version() {
    return this._data ? this.get("__version__") : false;
  }
  id() {
    return this.get(documentId());
  }
}

class QuerySnapshot {
  constructor(data) {
    this._docs = null;
    this._data = data;
  }
  get docs() {
    return this._docs || (this._docs = this._data.map((e) => e.data()));
  }
}
/** @type {Record<string, Function[]>} */
const localUpdates = {};

function toSnapshot(_query, prevSnapshot, res, isDoc) {
  const docs = res.rows.map((e) => {
    if (typeof e === "string") {
      return prevSnapshot._data.find((e) => e.id());
    } else
      return new DocumentSnapshot(_query.ref, _query.converter, e, res.columns);
  });
  return isDoc
    ? docs[0] || new DocumentSnapshot(_query.ref)
    : new QuerySnapshot(docs);
}
export function onSnapshot(_query, opts) {
  let cursor;
  let isDoc = "path" in _query;
  if (isDoc) {
    _query = query(
      _query.ref.parent,
      where(documentId(), "==", _query.id)
    ).withConverter(_query.converter);
  }
  const url =
    "/poll/" +
    encodeURIComponent(_query.ref.path) +
    "?query=" +
    encodeURIComponent(JSON.stringify(_query.query));
  let prevSnapshot,
    i,
    checking = 0;
  const check = async function () {
    let snapshot;
    if (checking > 0) {
      console.log("waiting");
      //Will refresh in less than a second
      checking = 2;
      return;
    }
    checking = 1;
    clearTimeout(i);
    try {
      const res = await _query.ref.airstore.api(
        url + (cursor ? "&cursor=" + encodeURIComponent(cursor) : "")
      );
      if (res.cursor !== true) {
        cursor = res.cursor;
      }
      if (res.rows) {
        prevSnapshot = snapshot = toSnapshot(_query, prevSnapshot, res, isDoc);
      }
      if (snapshot) return opts.next(snapshot);
    } catch (e) {
      if (i !== null) {
        opts.error ? opts.error(e) : console.error(e);
      }
    } finally {
      checking--;
      if (i !== null) {
        i = setTimeout(
          () => {
            checking = 0;
            check();
          },
          checking === 0 ? (snapshot ? 5000 : 10000 /*min frequency */) : 1000 //max frequency of requests
        );
        console.log(checking === 0 ? (snapshot ? 5000 : 10000) : 1000);
      }
    }
  };

  if (!localUpdates[_query.ref.path]) localUpdates[_query.ref.path] = [];
  localUpdates[_query.ref.path].push(check);
  check();
  return () => {
    clearTimeout(i);
    i = null;
    let m = localUpdates[_query.ref.path].indexOf(check);
    if (m > -1) localUpdates[_query.ref.path].splice(m, 1);
  };
}
async function _getDocs(query, isDoc) {
  return toSnapshot(
    query,
    null,
    await query.ref.airstore.api(
      "/collection/" +
        encodeURIComponent(query.ref.path) +
        "?query=" +
        encodeURIComponent(JSON.stringify(query.query))
    ),
    isDoc
  );
}

export async function getDocs(_query) {
  if (!_query.ref) {
    _query = query(_query);
  }
  return _getDocs(_query, false);
}
export async function getDoc(ref) {
  return _getDocs(query(ref.parent, where(documentId(), "==", ref.id)), true);
}
export async function getCountFromServer(query) {
  return toSnapshot(
    {},
    null,
    await query.ref.airstore.api(
      "/count/" +
        encodeURIComponent(query.ref.path) +
        "?query=" +
        encodeURIComponent(JSON.stringify(query.query))
    ),
    true
  );
}
export function where(prop, op, val) {
  return {
    filter: {
      prop,
      op,
      val,
    },
  };
}
export function orderBy(prop, desc, ...args) {
  let x = {
    props: [prop],
    desc: [desc],
  };
  for (let i = 0; i < args.length; i++) {
    x.order.push(args[i]);
    x.desc.push(args[i]);
  }
  return {
    order: x,
  };
}
export function startAfter(...vals) {
  return {
    cursor: vals,
    op: ">",
  };
}
export function limit(num) {
  return {
    limit: num,
  };
}
export function endBefore(...vals) {
  return {
    cursor: vals,
    op: "<",
  };
}
export function limitToLast(num) {
  return {
    limit: -num,
  };
}

class Batch {
  airstore;
  constructor(airstore) {
    this.airstore = airstore;
  }
  /**
   * @type {Record<"reads"|"writes", any[][]>}
   */
  spec = { writes: [], reads: [] };
  set(ref, data) {
    this.spec.writes.push([ref.parent.path, ref.id, data, "create&update"]);
  }
  update(ref, data) {
    this.spec.writes.push([ref.parent.path, ref.id, data, "update"]);
  }
  create(ref, data) {
    this.spec.writes.push([ref.parent.path, ref.id, data, "create"]);
  }
  delete(ref) {
    this.spec.writes.push([ref.parent.path, ref.id, null, "delete"]);
  }
  async commit() {
    await this.airstore.api("/transaction", "POST", this.spec);
  }
}

class Transaction extends Batch {
  constructor(airstore) {
    super(airstore);
  }
  async get(ref) {
    const x = await getDoc(ref);
    this.spec.reads.push([ref.parent.path, ref.id, x.exists() && x.version()]);
    return x;
  }
}

export async function runTransaction(airstore, cb) {
  for (let i = 0; i < 10; i++) {
    let x = new Transaction(airstore);
    await cb(x);
    try {
      await x.commit();
      break;
    } catch (e) {
      if (i === 9) throw e;
      console.warn(e);
    }
  }
}
export function writeBatch(airstore) {
  return new Batch(airstore);
}

class FieldValue {
  __isUpdateValue__ = true;
  constructor(type, val) {
    this.type = type;
    this.val = val;
  }
}
export function documentId() {
  return "__id__";
}
export function deleteField() {
  return new FieldValue("f-");
}
export function increment(val) {
  return new FieldValue("i+", val);
}
export function arrayUnion(...val) {
  return new FieldValue("a+", val);
}
export function arrayRemove(...val) {
  return new FieldValue("a-", val);
}
