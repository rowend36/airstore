import { createClient } from "@libsql/client";
import { unflatten } from "./props.js";

/**
 * @type {"libsql"|"d1"|"better-sqlite3"}
 */
let mode = "turso";
const tursoDB =
  mode === "turso"
    ? createClient({
        url: "libsql://airstore-rowend36.turso.io",
        authToken:
          "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJpYXQiOiIyMDIzLTEyLTI0VDA4OjA5OjAxLjc2MTEwODYxWiIsImlkIjoiMjY4ZWNhZWUtYTBmMi0xMWVlLThlM2ItODJkNWI0ZmViMTJjIn0.QOx4Yn5yaLQxJnXQRq0SEvE_k4dRk4T448Aa1flwsKXZw-74eo-KvIbX2r86piFkgsvfbPxixdADfGikS5FSDg",
      })
    : null;

import { LRUCache } from "lru-cache";
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

export async function dbBatch(stmts) {
  return await tursoDB.batch(
    sqls.map(({ sql, args }, i) => ({ sql: sql, args })),
    "write"
  );
}

export async function dbExecute(sql, args) {
  return await tursoDB.execute({ sql, args });
}

export async function dbGet(sql, args) {
  const res = await tursoDB.execute({ sql, args });
  return res[0] && unflatten(res.rows[0], res.columns);
}

export async function dbAll(sql, args) {
  const res = await tursoDB.execute({ sql, args });
  return res.rows.map((e) => unflatten(e, res.columns));
}

export async function dbRaw(sql, args) {
  return await tursoDB.execute({ sql, args });
}

/**
 *
 * @param {(txn: import("@libsql/client").Transaction)=>void} cb
 */
export async function dbTransaction(cb) {
  const txn = await tursoDB.transaction("write");
  try {
    await cb(txn);
  } finally {
    txn.close();
  }
}
