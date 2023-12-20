const path = require('path');
const Database  = require("better-sqlite3");

module.exports = new Database(path.resolve(__dirname, "../../db.sqlite"))
