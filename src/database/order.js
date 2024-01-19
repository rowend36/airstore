import { clean, inbuiltProps } from "./props.js";

class OrderBy {
  props = [];
  desc = [];
  reversed = false;
  constructor(props, desc, reversed = false) {
    this.props = props;
    this.desc = desc;
    this.reversed = reversed;
  }
  reverse() {
    this.desc = this.desc.map((e) => (e === "desc" ? "asc" : "desc"));
    this.reversed = !this.reversed;
  }
  compile() {
    return {
      sql:
        this.props.length &&
        ` ORDER BY ${this.props.map(
          (e, i) =>
            `${inbuiltProps[e] ? e : `json_extract(${clean(e)}, '$')`} ${
              this.desc[i] === "desc" ? "DESC" : "ASC"
            }`
        )}`,
      args: [],
    };
  }
}

export default function createOrderBy(cols, spec) {
  const valid = spec.props.map(
    (e) => inbuiltProps[e] || cols.indexOf(clean(e)) > -1
  );
  return new OrderBy(
    spec.props.filter((e, i) => valid[i]),
    spec.desc.filter((e, i) => valid[i])
  );
}
