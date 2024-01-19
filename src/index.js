import { env } from "process";
import { serve } from "@hono/node-server";
import app from "./app.js";

// Start the server
const PORT = env.PORT || 3001;
serve({ fetch: app.fetch, port: PORT }, (c) => {
  console.log(`Server is running on port ${c.port}`);
});
