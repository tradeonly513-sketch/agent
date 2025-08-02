import { createRequestHandler } from "@remix-run/express";
import express from "express";
import path from "path";

const app = express();

app.use(express.static("public"));

app.all(
  "*",
  createRequestHandler({
    build: await import("./build/server/index.js"),
    mode: process.env.NODE_ENV,
  })
);

app.listen(3000, () => {
  console.log("Server is running on http://localhost:3000");
});
