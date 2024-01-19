function arrayUnion(prop, args) {
  const m = JSON.stringify(args);
  return {
    sql: `
iif(
  json_type(${prop}) == 'array',
  (SELECT json_group_array(value) FROM
    (SELECT value FROM (
      SELECT value, 1 AS rs FROM json_each(${prop}) UNION
      SELECT value, 2 FROM json_each(json(?))
    ) T GROUP BY value ORDER BY min(rs))
  ),
  json(?)
)`,
    args: [m, m],
    sqlCreate: `json(?)`,
    argsCreate: [m],
  };
}

function arrayRemove(prop, args) {
  return {
    sql: `
iif(
  json_type(${prop}) == 'array',
  (SELECT json_group_array(value) FROM 
    (SELECT value FROM json_each(${prop}) WHERE value NOT IN 
      (SELECT value FROM json_each(json(?)))
    )
  ),
  json('[]')
)`,
    args: [JSON.stringify(args)],
    sqlCreate: `json('[]')`,
    argsCreate: [],
  };
}

function increment(prop, arg) {
  return {
    sql: `json(iif(json_type(${prop}) IN ('real', 'integer'),${prop},0) + ?)`,
    args: [arg],
    sqlCreate: "json(?)",
  };
}

export default function updateValue(key, val) {
  switch (val.type) {
    case "a+":
      return arrayUnion(key, val.val);
    case "a-":
      return arrayRemove(key, val.val);
    case "f-":
      return {
        sql: "?",
        args: [null],
      };
    case "i+":
      return increment(key, val.val);
    case "t":
      return {
        sql: "CURRENT_TIMESTAMP",
        args: [],
      };
    default:
      throw new Error("Unknown update operation " + val.type);
  }
}
