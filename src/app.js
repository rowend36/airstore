// app.js

const express = require("express");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");
const path = require("path");
const bodyParser = require("body-parser");
const auth = require("./database/auth");
const Collection = require("./database/collection");
const app = express();
const runTransaction = require("./database/transaction");

// Helmet middleware for enhancing server security
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        "connect-src": ["'self'", "https://*", "http://*", "*"],
      },
    },
  })
);

// Compress all routes
app.use(compression());

// Logging middleware using Morgan
app.use(morgan("dev"));

// Serving static files
app.use(express.static(path.join(path.dirname(__dirname), "public")));

// Routes and APIs
// app.use(auth);
app.use(bodyParser.json());
app.get("/collection/:collection", (req, res) =>
  res.json(
    Collection.of(req.params.collection).get(
      req.query.query ? JSON.parse(req.query.query) : null
    ) || {done: true}
  )
);
app.get("/count/:collection", (req, res) =>
  res.json(
    Collection.of(req.params.collection).count(
      req.query.query ? JSON.parse(req.query.query) : null
    ) || {done: true}
  )
);

app.get("/poll/:collection", (req, res) => {
  console.log({p: req.params, q: req.query});
  res.json(
    Collection.of(req.params.collection).poll(
      req.query.cursor,
      req.query.query ? JSON.parse(req.query.query) : null
    ) || {done: true}
  );
});

app.post("/delete/:collection/:id", (req, res) => {
  res.json({
    done: Collection.of(req.params.collection).delete({__id__: req.params.id}),
  });
});
app.post("/set/:collection/:id", (req, res) => {
  console.log(req.params, req.query);
  Collection.of(req.params.collection).set(
    {
      __id__: req.params.id,
      ...req.body,
    },
    {
      exists:
        "create" in req.query
          ? "update" in req.query
            ? undefined
            : false
          : true,
    }
  );
  res.json({done: true});
});
app.post("/transaction/", async (req, res) => {
  console.log(req.body);
  await runTransaction(req.body);
  res.json({done: true});
});
app.get("/block", function (req, res) {
  require("./database/db").transaction(() => {
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
// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
