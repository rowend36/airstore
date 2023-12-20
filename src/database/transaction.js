const db = require("./db");
const Collection = require("./collection");
function runTransaction(spec) {
  if (!spec.writes.length) return;
  db.transaction(() => {
    spec.reads.forEach(function ([collection, id, version]) {
      let m = Collection.of(collection).get({__id__: id});

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
  }).immediate();
}

module.exports = runTransaction;