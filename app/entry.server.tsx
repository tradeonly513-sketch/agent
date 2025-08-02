// app/entry.server.tsx
import { PassThrough } from "stream";
import { RemixServer } from "@remix-run/react";
import type { EntryContext } from "@remix-run/node";
import { renderToPipeableStream } from "react-dom/server";

const ABORT_DELAY = 10_000; // 10s

export default function handleRequest(
  request: Request,
  status: number,
  headers: Headers,
  context: EntryContext
) {
  return new Promise((resolve, reject) => {
    let didError = false;

    const { pipe, abort } = renderToPipeableStream(
      <RemixServer context={context} url={request.url} />,
      {
        onShellReady() {
          headers.set("Content-Type", "text/html");
          const body = new PassThrough();
          resolve(new Response(body as any, { status: didError ? 500 : status, headers }));
          pipe(body);
        },
        onShellError(err) {
          reject(err);
        },
        onError(err) {
          didError = true;
          if (process.env.NODE_ENV !== "production") console.error(err);
        },
      }
    );

    setTimeout(abort, ABORT_DELAY);
  });
}

