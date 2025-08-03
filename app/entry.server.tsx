// app/entry.server.tsx
import type { EntryContext } from "@remix-run/node";
import { RemixServer } from "@remix-run/react";
import { PassThrough } from "node:stream"; // prefer node: prefix
import { renderToPipeableStream } from "react-dom/server";

const ABORT_DELAY = 10_000;

export default function handleRequest(
  request: Request,
  status: number,
  headers: Headers,
  context: EntryContext
) {
  return new Promise<Response>((resolve, reject) => {
    let didError = false;

    const { pipe, abort } = renderToPipeableStream(
      <RemixServer context={context} url={request.url} />,
      {
        onShellReady() {
          const body = new PassThrough();
          const responseHeaders = new Headers(headers);
          responseHeaders.set("Content-Type", "text/html");

          resolve(
            new Response(body as any, {
              status: didError ? 500 : status,
              headers: responseHeaders,
            })
          );

          pipe(body);
        },
        onShellError(err) {
          reject(err);
        },
        onError(err) {
          didError = true;
          if (process.env.NODE_ENV !== "production") {
            console.error(err);
          }
        },
      }
    );

    setTimeout(abort, ABORT_DELAY);
  });
}

