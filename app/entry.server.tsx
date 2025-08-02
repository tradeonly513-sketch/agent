import type { EntryContext } from "@remix-run/node";
import { RemixServer } from "@remix-run/react";
import { PassThrough } from "stream";
import { renderToPipeableStream } from "react-dom/server";

const ABORT_DELAY = 5000;

export default function handleRequest(
  request: Request,
  status: number,
  headers: Headers,
  remixContext: EntryContext
) {
  return new Promise<Response>((resolve, reject) => {
    let didError = false;

    const { pipe, abort } = renderToPipeableStream(
      <RemixServer context={remixContext} url={request.url} />,
      {
        onShellReady() {
          headers.set("Content-Type", "text/html; charset=utf-8");
          const body = new PassThrough();
          const response = new Response(body as unknown as ReadableStream, {
            status: didError ? 500 : status,
            headers,
          });
          resolve(response);
          pipe(body);
        },
        onShellError(err) {
          reject(err);
        },
        onError(err) {
          didError = true;
          console.error(err);
        },
      }
    );

    setTimeout(abort, ABORT_DELAY);
  });
}
