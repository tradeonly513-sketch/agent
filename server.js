import { createRequestHandler } from "@remix-run/express";
import express from "express";
import path from "path";

const app = express();

app.use(express.static("public"));

app.all("*", async (req, res, next) => {
  const mod = await import("./build/server/index.js");
  const build = mod.default ?? mod; // works for both ESM and CJS
  return createRequestHandler({
    build,
    mode: process.env.NODE_ENV,
  })(req, res, next);
});

app.listen(3000, () => {
  console.log("Server is running on http://localhost:3000");
});
