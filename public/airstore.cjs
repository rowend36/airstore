var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/database/props.js
var require_props = __commonJS({
  "src/database/props.js"(exports) {
    var inbuiltProps2 = {
      __version__: true,
      __id__: true,
      rowid: true
    };
    exports.inbuiltProps = inbuiltProps2;
    exports.validCollection = function(path) {
      return !/___/.test(path) && /^[a-z][a-z_0-9]+(\/[a-z][a-z_0-9]+\/[a-z][a-z_0-9]+)*$/.test(path);
    };
    exports.clean = function clean2(key, m) {
      if (m !== true)
        console.log(key, clean2(key, true));
      return inbuiltProps2[key] || key.startsWith('"___') ? key : /(?:^[^a-z_]|[^a-z0-9_])/.test(key) ? JSON.stringify(
        key.startsWith("___") ? key : "___" + key.replace(/\./g, "___") + "__"
      ) : key.startsWith("___") ? key : "___" + key.replace(/\./g, "___") + "__";
    };
    exports.unflatten = function(data) {
      const obj = {};
      for (let key in data) {
        if (key.slice(0, 3) === "___") {
          let i = key.slice(3, -2);
          if (i.indexOf("___") > -1) {
            const path = i.split("___");
            let ctx = obj;
            for (let j = 0; j < path.length - 1; j++) {
              ctx = ctx[path[j]] = {};
            }
            ctx[path[path.length - 1]] = data[key];
          } else {
            obj[i] = data[key];
          }
        } else
          obj[key] = data[key];
      }
      return obj;
    };
    function checkValid(key) {
      if (key.indexOf("___") > -1) {
        throw "Invalid key";
      }
    }
    exports.flatten = function flatten(data, prefix = "") {
      let c = {};
      for (let i in data) {
        checkValid(i);
        if (data[i] && typeof data[i] === "object" && !Array.isArray(data[i]) && !data[i].__isUpdateValue__) {
          c[prefix + i] = flatten(data[i], prefix + i + ".");
        } else {
          c[prefix + i] = data[i];
        }
      }
      if (!data.hasOwnProperty("__version__"))
        c.__version__ = Date.now();
      return c;
    };
  }
});

// src/database/client.js
var client_exports = {};
__export(client_exports, {
  addDoc: () => addDoc,
  arrayRemove: () => arrayRemove,
  arrayUnion: () => arrayUnion,
  collection: () => collection,
  deleteDoc: () => deleteDoc,
  deleteField: () => deleteField,
  doc: () => doc,
  documentId: () => documentId,
  endBefore: () => endBefore,
  getAirstore: () => getAirstore,
  getCountFromServer: () => getCountFromServer,
  getDoc: () => getDoc,
  getDocs: () => getDocs,
  increment: () => increment,
  limit: () => limit,
  limitToLast: () => limitToLast,
  onSnapshot: () => onSnapshot,
  orderBy: () => orderBy,
  query: () => query,
  queryEqual: () => queryEqual,
  ref: () => ref,
  refEqual: () => refEqual,
  runTransaction: () => runTransaction,
  setDoc: () => setDoc,
  startAfter: () => startAfter,
  updateDoc: () => updateDoc,
  where: () => where,
  writeBatch: () => writeBatch
});
module.exports = __toCommonJS(client_exports);
var props = __toESM(require_props());

// node_modules/uuid/dist/esm-browser/rng.js
var getRandomValues;
var rnds8 = new Uint8Array(16);
function rng() {
  if (!getRandomValues) {
    getRandomValues = typeof crypto !== "undefined" && crypto.getRandomValues && crypto.getRandomValues.bind(crypto);
    if (!getRandomValues) {
      throw new Error("crypto.getRandomValues() not supported. See https://github.com/uuidjs/uuid#getrandomvalues-not-supported");
    }
  }
  return getRandomValues(rnds8);
}

// node_modules/uuid/dist/esm-browser/stringify.js
var byteToHex = [];
for (let i = 0; i < 256; ++i) {
  byteToHex.push((i + 256).toString(16).slice(1));
}
function unsafeStringify(arr, offset = 0) {
  return byteToHex[arr[offset + 0]] + byteToHex[arr[offset + 1]] + byteToHex[arr[offset + 2]] + byteToHex[arr[offset + 3]] + "-" + byteToHex[arr[offset + 4]] + byteToHex[arr[offset + 5]] + "-" + byteToHex[arr[offset + 6]] + byteToHex[arr[offset + 7]] + "-" + byteToHex[arr[offset + 8]] + byteToHex[arr[offset + 9]] + "-" + byteToHex[arr[offset + 10]] + byteToHex[arr[offset + 11]] + byteToHex[arr[offset + 12]] + byteToHex[arr[offset + 13]] + byteToHex[arr[offset + 14]] + byteToHex[arr[offset + 15]];
}

// node_modules/uuid/dist/esm-browser/native.js
var randomUUID = typeof crypto !== "undefined" && crypto.randomUUID && crypto.randomUUID.bind(crypto);
var native_default = {
  randomUUID
};

// node_modules/uuid/dist/esm-browser/v4.js
function v4(options, buf, offset) {
  if (native_default.randomUUID && !buf && !options) {
    return native_default.randomUUID();
  }
  options = options || {};
  const rnds = options.random || (options.rng || rng)();
  rnds[6] = rnds[6] & 15 | 64;
  rnds[8] = rnds[8] & 63 | 128;
  if (buf) {
    offset = offset || 0;
    for (let i = 0; i < 16; ++i) {
      buf[offset + i] = rnds[i];
    }
    return buf;
  }
  return unsafeStringify(rnds);
}
var v4_default = v4;

// src/database/client.js
function getAirstore(root, app) {
  return {
    async api(path, method = "GET", body = "") {
      return await (await fetch(root + path, {
        body: method !== "GET" ? JSON.stringify(body || {}) : void 0,
        headers: {
          authorization: app.auth && app.auth.currentUser ? await app.auth.currentUser.getIdToken(
            /* forceRefresh */
            true
          ).catch(function(error) {
            console.error(error);
          }) : null,
          "Content-Type": "application/json"
        },
        method
      })).json();
    }
  };
}
function ref(path, airstore) {
  return {
    path,
    id: path.split("/").pop(),
    airstore,
    /** @type {any} */
    _parent: null,
    get parent() {
      return this._parent || (this._parent = ref(path.slice(0, -this.id.length - 1), airstore));
    }
  };
}
function collection(...path) {
  let airstore = typeof path[0] == "object" ? path.shift() : null;
  const m = path.join("/");
  if (m.split("/").length % 2 !== 1)
    throw new Error("Wrong number of segments in collection");
  if (!props.validCollection(m))
    throw new Error("Invalid path " + path);
  return ref(m, airstore);
}
function doc(...path) {
  let airstore;
  if (typeof path[0] == "object") {
    if (path[0].api) {
      airstore = path.shift();
    } else if (path[0].airstore) {
      airstore = path[0].airstore;
      path[0] = path[0].path;
      if (path.length === 1)
        path.push(v4_default().replace(/\-/g, ""));
    } else
      throw new Error("Invalid path: " + path);
  }
  console.log(path);
  const m = path.join("/") ?? v4_default().replace(/\-/g, "");
  if (m.split("/").length % 2 !== 0)
    throw new Error("Wrong number of segments in doc");
  return ref(m, airstore);
}
function refEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}
function queryEqual(a, b) {
  return refEqual(a, b);
}
async function mutateDoc(ref2, url, method, data) {
  try {
    return await ref2.airstore.api(url, method, data);
  } finally {
    const s = localUpdates[ref2.parent.path];
    if (s) {
      s.forEach((e) => e());
    }
  }
}
async function deleteDoc(ref2) {
  return await mutateDoc(
    ref2,
    "/delete/" + encodeURIComponent(ref2.parent.path) + "/" + encodeURIComponent(ref2.id),
    "POST"
  );
}
async function setDoc(ref2, data, opts) {
  if (!opts || !opts.merge)
    throw new Error("merge must be true");
  return await mutateDoc(
    ref2,
    "/set/" + encodeURIComponent(ref2.parent.path) + "/" + encodeURIComponent(ref2.id) + "?create&update",
    "POST",
    data
  );
}
async function addDoc(ref2) {
  return await mutateDoc(
    doc(ref2),
    "/set/" + encodeURIComponent(ref2.parent.path) + "/" + encodeURIComponent(ref2.id) + "?create",
    "POST"
  );
}
async function updateDoc(ref2, data) {
  return await mutateDoc(
    ref2,
    "/set/" + encodeURIComponent(ref2.parent.path) + "/" + encodeURIComponent(ref2.id) + "?update",
    "POST",
    data
  );
}
function query(ref2, ...specs) {
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
    if (spec.limit !== void 0) {
      if (t.limit !== void 0)
        throw new Error("Duplicate limit clause");
      t.limit = spec.limit;
    }
  }
  for (let spec of specs) {
    if (spec.cursor) {
      for (let i = 0; i < spec.cursor.length; i++) {
        specs.push({
          filter: {
            prop: typeof spec.cursor[i] === "object" ? documentId() : t.order.props[i],
            op: spec.op,
            val: spec.cursor[i]
          }
        });
      }
    }
  }
  for (let spec of specs) {
    if (spec.filter) {
      if (t.filter && !t.filter.next)
        t.filter.next = spec.filter;
      else if (!t.filter || !spec.next) {
        t.filter = { ...spec.filter, next: t.filter };
      } else {
        t.filter = {
          val: t.filter,
          next: spec.filter
        };
      }
    }
  }
  return {
    query: t,
    converter: void 0,
    withConverter(converter) {
      return { ...this, converter };
    },
    ref: ref2
  };
}
var DocumentSnapshot = class {
  constructor(ref2, conv, data, columns) {
    this.ref = ref2;
    this._conv = conv;
    this._data = data;
    this.columns = columns;
  }
  data(options) {
    if (!options && this._conv)
      return this._conv.fromFirestore(this, {});
    if (!this._data)
      return;
    const s = {};
    for (let i = 0; i < this.columns.length; i++) {
      if (!props.inbuiltProps[this.columns[i]])
        s[this.columns[i]] = this._data[i];
    }
    return props.unflatten(s);
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
};
var QuerySnapshot = class {
  constructor(data) {
    this._docs = null;
    this._data = data;
  }
  get docs() {
    return this._docs || (this._docs = this._data.map((e) => e.data()));
  }
};
var localUpdates = {};
function toSnapshot(_query, prevSnapshot, res, isDoc) {
  const docs = res.rows.map((e) => {
    if (typeof e === "string") {
      return prevSnapshot._data.find((e2) => e2.id());
    } else
      return new DocumentSnapshot(_query.ref, _query.converter, e, res.columns);
  });
  return isDoc ? docs[0] || new DocumentSnapshot(_query.ref) : new QuerySnapshot(docs);
}
function onSnapshot(_query, opts) {
  let cursor;
  let isDoc = "path" in _query;
  if (isDoc) {
    _query = query(
      _query.ref.parent,
      where(documentId(), "==", _query.id)
    ).withConverter(_query.converter);
  }
  const url = "/poll/" + encodeURIComponent(_query.ref.path) + "?query=" + encodeURIComponent(JSON.stringify(_query.query));
  let prevSnapshot, i, checking = 0;
  const check = async function() {
    let snapshot;
    if (checking > 0) {
      console.log("waiting");
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
      if (snapshot)
        return opts.next(snapshot);
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
          checking === 0 ? snapshot ? 5e3 : 1e4 : 1e3
          //max frequency of requests
        );
        console.log(checking === 0 ? snapshot ? 5e3 : 1e4 : 1e3);
      }
    }
  };
  if (!localUpdates[_query.ref.path])
    localUpdates[_query.ref.path] = [];
  localUpdates[_query.ref.path].push(check);
  check();
  return () => {
    clearTimeout(i);
    i = null;
    let m = localUpdates[_query.ref.path].indexOf(check);
    if (m > -1)
      localUpdates[_query.ref.path].splice(m, 1);
  };
}
async function _getDocs(query2, isDoc) {
  return toSnapshot(
    query2,
    null,
    await query2.ref.airstore.api(
      "/collection/" + encodeURIComponent(query2.ref.path) + "?query=" + encodeURIComponent(JSON.stringify(query2.query))
    ),
    isDoc
  );
}
async function getDocs(_query) {
  if (!_query.ref) {
    _query = query(_query);
  }
  return _getDocs(_query, false);
}
async function getDoc(ref2) {
  return _getDocs(query(ref2.parent, where(documentId(), "==", ref2.id)), true);
}
async function getCountFromServer(query2) {
  return toSnapshot(
    {},
    null,
    await query2.ref.airstore.api(
      "/count/" + encodeURIComponent(query2.ref.path) + "?query=" + encodeURIComponent(JSON.stringify(query2.query))
    ),
    true
  );
}
function where(prop, op, val) {
  return {
    filter: {
      prop,
      op,
      val
    }
  };
}
function orderBy(prop, desc, ...args) {
  let x = {
    props: [prop],
    desc: [desc]
  };
  for (let i = 0; i < args.length; i++) {
    x.order.push(args[i]);
    x.desc.push(args[i]);
  }
  return {
    order: x
  };
}
function startAfter(...vals) {
  return {
    cursor: vals,
    op: ">"
  };
}
function limit(num) {
  return {
    limit: num
  };
}
function endBefore(...vals) {
  return {
    cursor: vals,
    op: "<"
  };
}
function limitToLast(num) {
  return {
    limit: -num
  };
}
var Batch = class {
  airstore;
  constructor(airstore) {
    this.airstore = airstore;
  }
  /**
   * @type {Record<"reads"|"writes", any[][]>}
   */
  spec = { writes: [], reads: [] };
  set(ref2, data) {
    this.spec.writes.push([ref2.parent.path, ref2.id, data, "create&update"]);
  }
  update(ref2, data) {
    this.spec.writes.push([ref2.parent.path, ref2.id, data, "update"]);
  }
  create(ref2, data) {
    this.spec.writes.push([ref2.parent.path, ref2.id, data, "create"]);
  }
  delete(ref2) {
    this.spec.writes.push([ref2.parent.path, ref2.id, null, "delete"]);
  }
  async commit() {
    await this.airstore.api("/transaction", "POST", this.spec);
  }
};
var Transaction = class extends Batch {
  constructor(airstore) {
    super(airstore);
  }
  async get(ref2) {
    const x = await getDoc(ref2);
    this.spec.reads.push([ref2.parent.path, ref2.id, x.exists() && x.version()]);
    return x;
  }
};
async function runTransaction(airstore, cb) {
  for (let i = 0; i < 10; i++) {
    let x = new Transaction(airstore);
    await cb(x);
    try {
      await x.commit();
      break;
    } catch (e) {
      if (i === 9)
        throw e;
      console.warn(e);
    }
  }
}
function writeBatch(airstore) {
  return new Batch(airstore);
}
var FieldValue = class {
  __isUpdateValue__ = true;
  constructor(type, val) {
    this.type = type;
    this.val = val;
  }
};
function documentId() {
  return "__id__";
}
function deleteField() {
  return new FieldValue("f-");
}
function increment(val) {
  return new FieldValue("i+", val);
}
function arrayUnion(...val) {
  return new FieldValue("a+", val);
}
function arrayRemove(...val) {
  return new FieldValue("a-", val);
}
