const {clean, inbuiltProps} = require("./props");

class Filter {
  prop = "";
  op = "";
  val = null;
  next = null;
  nextType = "AND";
  constructor(prop, op, val, next, nextType) {
    this.prop = prop;
    this.op = op;
    // Currently, we convert all values to JSON and then extract them in the query.
    // TODO: check performance penalty for this.
    this.val =
      !op || inbuiltProps[prop]
        ? val
        : Array.isArray(val) && /in|any/.test(op)
        ? val.map((e) => JSON.stringify(e))
        : JSON.stringify(val);
    this.next = next;
    this.nextType = nextType;
  }
  _addMultipleValues(n, extract = false) {
    // Uses string comparison so no need for json extract
    n.sql +=
      " (" +
      this.val
        .map((e) =>
          inbuiltProps[this.prop] ? "?" : `json_extract(json(?), '$')`
        )
        .join(", ") +
      ")";
    n.args.push(...this.val);
  }
  _expr() {
    if (this.val instanceof Filter) return this.val._fullExpr();

    switch (this.op) {
      case "IS":
      case "IS NOT":
      case ">":
      case "<":
      case ">=":
      case "<=":
        return {
          sql: `${
            inbuiltProps[this.prop]
              ? this.prop
              : `json_extract(${this.prop}, '$')`
          } ${this.op} ${
            inbuiltProps[this.prop] ? "?" : `json_extract(json(?), '$')`
          }`,
          args: [this.val],
        };
      case "in":
        const m = {
          sql: `${
            inbuiltProps[this.prop]
              ? this.prop
              : `json_extract(${this.prop}, '$')`
          } IN`,
          args: [],
        };
        this._addMultipleValues(m);
        return m;
      case "not-in":
        const n = {
          sql: `${
            inbuiltProps[this.prop]
              ? this.prop
              : `json_extract(${this.prop}, '$')`
          } NOT IN`,
          args: [],
        };
        this._addMultipleValues(n);
        return n;
      // This last two queries are not optimized at all. One possible solution is to keep an array table for each prop.
      // However for most queries, this is not an issue since we use cursors and scanning is fast.
      case "array-contains":
        return {
          sql: `json_type(${this.prop}) = 'array' AND EXISTS (SELECT 1 FROM json_each(${this.prop}) WHERE value = json_extract(json(?), '$'))`,
          args: [this.val],
        };
      case "array-contains-any":
        const r = {
          sql: `json_type(${this.prop}) = 'array' AND EXISTS (SELECT 1 FROM json_each(${this.prop}) WHERE value IN`,
          args: [],
        };
        this._addMultipleValues(r);
        r.sql += ")";
        return r;
      default:
        throw new Error("Unknown op " + this.op);
    }
  }
  _fullExpr() {
    const t = this._expr();
    if (this.next) {
      const k = this.next._fullExpr();
      t.sql =
        "(" +
        t.sql +
        " " +
        this.nextType +
        " " +
        (this.next.next && this.next.nextType === this.nextType
          ? k.sql.slice(1, -1)
          : k.sql) +
        ")";
      t.args.push(...k.args);
    }
    return t;
  }
  compile() {
    const t = this._fullExpr();
    t.sql = "WHERE " + t.sql;
    return t;
  }
}

function createFilter(cols, spec) {
  return new Filter(
    cols.indexOf(clean(spec.prop)) < 0 ? "'NULL'" : clean(spec.prop),
    spec.op == "==" ? "IS" : spec.op == "!=" ? "IS NOT" : spec.op,
    !spec.op ? createFilter(cols, spec.val) : spec.val,
    spec.next ? createFilter(cols, spec.next) : null,
    spec.next && (spec.nextType || "AND")
  );
}

module.exports = createFilter;