class Limit {
  limit = null;
  constructor(limit) {
    this.limit = limit ?? null;
  }
  compile() {
    if (this.limit === null) {
      return {
        sql: "",
        args: [],
      };
    }
    return {
      sql: ` LIMIT ${this.limit}`,
      args: [],
    };
  }
}

export default function createLimit(order, spec) {
  if (spec && spec < 0 !== order.reversed) {
    order.reverse();
    console.log("Reversing order");
  }
  return new Limit(spec && Math.abs(spec));
}
