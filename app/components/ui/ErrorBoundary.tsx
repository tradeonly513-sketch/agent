import { isRouteErrorResponse, useRouteError } from '@remix-run/react';

export function ErrorBoundary() {
  const error = useRouteError();

  return (
    <div className="flex items-center justify-center  px-6 py-12">
      <div className="max-w-xl w-full bg-white shadow-xl rounded-2xl p-8 text-center">
        {isRouteErrorResponse(error) ? (
          <>
            <h1 className="text-5xl font-extrabold mb-4">{error.status}</h1>
            <h2 className="text-3xl font-semibold text-gray-800 mb-2">{error.statusText}</h2>
            <p className="text-xl text-gray-600 mb-6">{error.data}</p>
          </>
        ) : error instanceof Error ? (
          <>
            <h1 className="text-3xl font-bold text-red-600 mb-4">Unexpected Error</h1>
            <p className="text-gray-700 mb-4">{error.message}</p>
            <details className="text-left bg-gray-50 p-4 rounded-lg text-sm text-gray-600">
              <summary className="cursor-pointer font-medium mb-2">Stack trace</summary>
              <pre className="whitespace-pre-wrap">{error.stack}</pre>
            </details>
          </>
        ) : (
          <>
            <h1 className="text-3xl font-bold text-red-600 mb-4">Unknown Error</h1>
            <p className="text-gray-600">An unknown error occurred.</p>
          </>
        )}
      </div>
    </div>
  );
}
