const process = require("process");
const { serve } = require("@hono/node-server");
const app = require("./app");

// Start the server
const PORT = process.env.PORT || 3001;
serve({ fetch: app.fetch, port: PORT }, (c) => {
  console.log(`Server is running on port ${c.port}`);
});
