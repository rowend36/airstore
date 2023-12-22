const { Hono } = require("hono");
const { cors } = require("hono/cors");
const { secureHeaders } = require("hono/secure-headers");
const helmet = require("helmet");
const { auth } = require("./middleware/auth");
const Collection = require("./database/collection");
const app = new Hono();
const runTransaction = require("./database/transaction");
const { logger } = require("hono/logger");
const { initDB } = require("./database/db");

app.use("*", logger());
app.use(
  "*",
  cors({
    // origin: [""]
  })
);
// Helmet middleware for enhancing server security
app.use(
  secureHeaders({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        "connect-src": ["'self'", "https://*", "http://*", "*"],
      },
    },
  })
);
app.use(auth);
app.use(initDB);
app.get("/collection/:collection", (c) => {
  return c.json(
    Collection.of(c.req.param().collection).get(
      c.req.query().query ? JSON.parse(c.req.query().query) : null
    ) || { done: true }
  );
});

app.get("/count/:collection", (c) =>
  c.json(
    Collection.of(c.req.param().collection).count(
      c.req.query().query ? JSON.parse(c.req.query().query) : null
    ) || { done: true }
  )
);

app.get("/poll/:collection", (c) => {
  console.log({ p: c.req.param(), q: c.req.query() });
  c.json(
    Collection.of(c.req.param().collection).poll(
      c.req.query().cursor,
      c.req.query().query ? JSON.parse(c.req.query().query) : null
    ) || { done: true }
  );
});

app.post("/delete/:collection/:id", (c) => {
  c.json({
    done: Collection.of(c.req.param().collection).delete({
      __id__: c.req.param().id,
    }),
  });
});
app.post("/set/:collection/:id", async (c) => {
  console.log(c.req.param(), c.req.query());
  Collection.of(c.req.param().collection).set(
    {
      __id__: c.req.param().id,
      ...(await c.req.json()),
    },
    {
      exists:
        "create" in c.req.query()
          ? "update" in c.req.query()
            ? undefined
            : false
          : true,
    }
  );
  c.json({ done: true });
});
app.post("/transaction/", async (c) => {
  await runTransaction(await c.req.json());
  c.json({ done: true });
});
app.get("/block", async function ({ res }) {
  await require("./database/db")
    .getDB()
    .transaction(() => {
      for (var i = 0; i < 25000; i++) {
        Collection.of("test").set({
          __id__: "test_" + i,
          hello: true,
          "bad id/t": {
            __isUpdateValue__: true,
            type: "a+",
            val: [5],
          },
          "add 1": {
            __isUpdateValue__: true,
            type: "i+",
            val: 5,
          },
          "add '1'": {
            __isUpdateValue__: true,
            type: "a+",
            val: [5],
          },
        });
      }
    })();
  res.sendStatus(200);
});

module.exports = app;
