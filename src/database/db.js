const { getRuntimeKey } = require("hono/adapter");
const path = require("path");
/**
 * @type {}
 */
let db;

exports.initDB = function (c, next) {
  if (getRuntimeKey() === "workerd") {
    db = c.env().DB;
  } else if (!db) {
    db = new (require("better-sqlite3").Database)(
      // eslint-disable-next-line no-undef
      path.resolve(__dirname, "../../db.sqlite")
    );
  }
  return next();
};
exports.getDB = () => db;
