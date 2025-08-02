import { createRequestHandler } from "@remix-run/express";
import express from "express";

const app = express();

// Serve static files from /public if present
app.use(express.static("public"));

app.all("*", async (req, res, next) => {
  // Load the Remix server build at runtime
  const mod = await import("./build/server/index.js");
  const build = mod.default ?? mod;
  return createRequestHandler({
    build,
    mode: process.env.NODE_ENV,
  })(req, res, next);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
