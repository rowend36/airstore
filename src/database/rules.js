const globals = {
  response: true,
  request: true,
};
class Rules {
  scope;
  matchers;
  constructor(matchers, scope) {
    this.matchers = matchers;
    this.scope = scope;
  }
  /**
   * @param {string} path
   * @param {'read'|'list'|'get'|'write'|'create'|'update'|'delete'} method
   * @param {Record<keyof typeof globals, any>} globals
   */
  allow(path, method, globals) {
    for (let i in this.scope) {
      this.scope[i] = globals[i];
    }
    return this.matchers.some((e) => e.match(path, method));
  }
}

function createMatchRe(path, ctx) {
  const segments = path
    .split("/")
    .filter(Boolean)
    .map((e) => {
      const varname = /{\s*([a-z_][a-z_0-9]*)\s*}/.exec(e);
      if (varname) {
        ctx[varname[1]] = true;
        return function (seg, ctx) {
          return !!seg && (ctx[varname[1]] = seg);
        };
      } else if (/[a-z_][a-z_0-9]*/.test(e)) {
        return function (seg) {
          return !!seg;
        };
      } else throw new Error("Error parsing path " + path);
    });
  return {
    matchPath(path) {
      const l = path.split("/").filter(Boolean);
      console.log({ l, segments });
      if (l.length < segments.length) return false;
      return segments.every((e, i) => e(l[i], this.scope)) && ctx;
    },
    allows: {
      get: [],
      list: [],
      create: [],
      update: [],
      delete: [],
      read: [],
      write: [],
    },
    scope: ctx,
    match(path, method) {
      if (!this.matchPath(path)) return false;
      const allows = this.allows[method];
      for (let allowFunction of allows) {
        try {
          if (this.scope[allowFunction]()) {
            return true;
          }
        } catch (e) {
          console.error(e);
        }
      }
      return false;
    },
  };
}

function createValidator(str) {
  /**
   * @type {Object[]}
   */
  const scopes = [{ ...globals }];
  const lines = str.split("\n");
  const expr = [];
  const matchRe = [];
  const stack = ["trailing", "expr"];
  const matchers = [];
  const allowedMethods = [];
  let g = 0;
  let match;
  let functionName;
  function enter(...state) {
    // console.log(...state, lines[i - 1]);
    stack.push(...state);
  }
  function peek() {
    return stack[stack.length - 1];
  }
  function pop() {
    // console.log("exit " + peek(), lines[i - 1]);
    return stack.pop();
  }
  function startScope() {
    scopes.push(Object.create(scopes[scopes.length - 1]));
  }
  function finalizeScope(scope) {
    /* TODO: remove allows from scope and use in allows directly.*/
    const vars = [];
    for (let key in scope) {
      vars.push(key);
    }
    const init =
      "const globalScope = arguments[0]; return function(...args){ const {" +
      vars.join(", ") +
      "} = globalScope; return ";
    for (let key in scope) {
      if (scope.hasOwnProperty(key) && scope[key] !== true) {
        // an expression
        scope[key] = Function(init + scope[key] + ";}")(scope);
      }
    }
  }

  function checkEndScopes(expression, isFunction, leaveInnerScopes) {
    let leftInnerScopeUnclosed = !leaveInnerScopes;
    let trailingBrace = isFunction ? /}\s*(}\s*)$/ : /(}\s*)$/;
    while (peek() === "in match" || peek() === "in service") {
      const trailingBraces = trailingBrace.exec(expression);
      if (!trailingBraces) break;
      pop(); // in match|in service
      // the current scope should not be finalized until the expression is complete
      if (pop() /*match|service*/ === "match") matchers.push(matchRe.pop());
      else enter("trailing", "expr");
      if (!leftInnerScopeUnclosed) {
        scopes.pop();
        leftInnerScopeUnclosed = true;
      } else {
        finalizeScope(scopes.pop());
      }
      expression = expression.slice(0, -trailingBraces[1].length);
    }
    return [expression, leftInnerScopeUnclosed];
  }
  function closeExpression() {
    if (peek() !== "expr") return;
    pop(); //expr
    const type = pop(); //function | allow | trailing
    const scope = scopes[scopes.length - 1];
    const methods = type === "function" ? null : allowedMethods.pop();
    const [expression, shouldCloseScope] = checkEndScopes(
      expr.splice(0).join("\n"),
      type === "function",
      true
    ); //remove closing braces of outer scopes
    new Function(expression);
    //validate syntax
    if (type === "trailing") return new Function(expression)(); // Non-standard feature;
    scope[functionName] =
      type === "function" ? "(" + expression + ")(...args)" : expression;
    if (methods) {
      methods.forEach(function (e) {
        matchRe[matchRe.length - 1].allows[e].push(functionName);
      });
    }
    if (shouldCloseScope) finalizeScope(scope);
  }
  let i = 0;
  try {
    for (let line of lines) {
      i++;
      // Detect opening brace
      if (
        (peek() === "service" || peek() === "match") &&
        (match = /^\s*{/.exec(line))
      ) {
        enter("in " + peek());
        line = line.slice(match[0].length);
      }
      //Rules version
      if (/^\s*rules_version\s*=\s*(['"])\d\1\s*;/.test(line)) {
        closeExpression();
        if (stack.length === 0) {
          enter("rules");
          enter("trailing", "expr");
          continue;
        } else throw new Error("Unexpected rules " + line);
      }
      // service declaration
      else if (
        (match = /^\s*service\s*cloud\.firestore\s*({\s*)?$/.exec(line))
      ) {
        closeExpression();
        if (stack.length === 0 || peek() == "rules") {
          enter("service");
          startScope();
          if (match[1]) enter("in " + peek());

          continue;
        } else throw new Error("Unexpected service " + line);
      }
      //match a line
      else if (/^\s*match/.test(line)) {
        closeExpression();
        if (peek() != "in service" && peek() != "in match") {
          throw new Error("Unexpected match " + line);
        }

        match = /^\s*match\b\s*(.+?)\s*({\s*)?$/.exec(line);

        if (!match) throw new Error("Error parsing " + line);
        enter("match");
        startScope();
        matchRe.push(createMatchRe(match[1], scopes[scopes.length - 1]));
        if (match[2]) enter("in " + peek());
      } else if (/^\s*allow/.test(line)) {
        closeExpression();
        if (peek() != "in match") {
          throw new Error("Unexpected allow " + line);
        }
        closeExpression();
        const path = /^\s*allow\b\s*([^:\n]+):\s*if([^;]*)(;?)$/.exec(line);
        if (!path) throw new Error("Error parsing rule " + line);
        const methods = path[1].split(",").map((e) => e.trim());
        let bad;
        if ((bad = methods.find((e) => !matchRe[matchRe.length - 1].allows[e])))
          throw new Error("Unknown method " + bad);
        enter("allow", "expr");
        allowedMethods.push(methods);
        functionName = "___g" + ++g;
        expr.push(path[2]);
        if (path[3]) closeExpression();
      } else if (/^\s*function/.test(line)) {
        if (peek() != "in service" && peek() != "in match") {
          throw new Error("Unexpected function " + line);
        }
        closeExpression();
        const parsed = /^\s*function\b\s*([a-z_][a-z_0-9]*).*$/.exec(line);
        if (!parsed) throw new Error("Error parsing " + line);
        enter("function", "expr");
        expr.push(line);
        functionName = parsed[1];
      } else if (peek() === "expr") {
        expr.push(line);
      } else {
        [line] = checkEndScopes(line);
        if (/^\s*$/.test(line)) continue;
        if (peek() !== "expr") {
          throw new Error("Unexpected tokens " + line);
        }
      }
    }
    closeExpression();
    //Trailing expression after service
    closeExpression();
    if (stack.length !== 0) {
      throw new Error("Unexpected end of file");
    }
  } catch (e) {
    console.log({
      scopes,
      lines,
      expr,
      matchRe,
      stack,
      matchers,
      allowedMethods,
    });
    e.message = "Parsing error on line " + i + ": " + e.message;
    throw e;
  }
  return new Rules(matchers, scopes[0]);
}

export default createValidator(require("./firestore-rules").default);
