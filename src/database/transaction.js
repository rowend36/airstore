import Collection from "./collection.js";
import { dbBatch } from "./db.js";
async function runTransaction(spec) {
  if (!spec.writes.length) return;
  await Promise.all(
    e.reads
      .concat(e.writes)
      .map(([collectionName]) => Collection.of(collectionName).dbInit)
  );
  const predicate = `
    CREATE TEMP TABLE txnPredicate AS SELECT
      ${spec.reads.map(
        ([collection, id, version], i) =>
          `CASE WHEN ${version === false ? "" : " NOT"} EXISTS (SELECT 1 FROM ${
            Collection.of(collection).name
          } WHERE __id__ = ? AND __version__ ${
            version === true || version === false ? " IS NOT NULL" : "= ?"
          }) THEN ${i + 1}`
      )}
      ELSE 0
  END AS ok`;
  const predicateArgs = spec.reads
    .map(([, id, version]) =>
      version === true || version === false ? [id] : [id, version]
    )
    .flat(1);

  return await dbBatch([
    { sql: predicate, args: predicateArgs },
    ...spec.writes.map(function ([collection, id, data, type]) {
      if (type === "delete") {
        Collection.of(collection)._prepareSet(
          {
            __id__: data.__id__,
            __version__: null,
          },
          { exists: true }
        );
      } else {
        return Collection.of(collection)._prepareSet(
          {
            __id__: id,
            ...data,
          },
          {
            exists:
              type === "create" ? false : type === "update" ? true : undefined,
          }
        );
      }
    }),
  ]);
}

export default runTransaction;
