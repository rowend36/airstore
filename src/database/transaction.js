const Collection = require("./collection").default;
const { getDB } = require("./db");
async function runTransaction(spec) {
  if (!spec.writes.length) return;
  await Promise.all(
    e.reads
      .concat(e.writes)
      .map(([collectionName]) => Collection.of(collectionName).dbInit)
  );
  const predicate = `WITH pred AS (
        SELECT CASE 
              ${spec.reads.map(
                ([collection, id, version]) =>
                  `WHEN NOT EXISTS (SELECT 1 FROM ${
                    Collection.of(collection).name
                  } WHERE id = ? AND version = ?) THEN 1`
              )}
                WHEN NOT EXISTS (SELECT 1 FROM test WHERE id = 3 AND version = 6) THEN 2)}
              ELSE 0
          END AS pred
  )`;

  const predicateArgs = spec.reads.map(([, id]) => id);

  await getDB()
    .transaction(() => {
      spec.reads.forEach(function ([collection, id, version]) {
        let m = Collection.of(collection).get({ __id__: id });

        if (
          (version === false && m.rows.length) ||
          (version && !m.rows.length) ||
          (typeof version === "string" &&
            version !== m.rows[0][m.columns.indexOf("__version__")])
        ) {
          throw new Error(
            "Transaction failed: Version mismatch " +
              collection +
              "/" +
              id +
              ": " +
              version +
              " != " +
              (m.rows.length
                ? m.rows[0][m.columns.indexOf("__version__")]
                : false)
          );
        }
      });
      try {
        spec.writes.forEach(function ([collection, id, data, type]) {
          if (type === "delete") {
            Collection.of(collection).delete({
              __id__: id,
            });
          } else {
            Collection.of(collection).set(
              {
                __id__: id,
                ...data,
              },
              {
                exists:
                  type === "create"
                    ? false
                    : type === "update"
                    ? true
                    : undefined,
              }
            );
          }
        });
      } catch (e) {
        e.message = "Transaction failed: " + e.message;
        throw e;
      }
    })
    .immediate();
}

module.exports = runTransaction;
