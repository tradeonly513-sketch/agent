import { isRouteErrorResponse, useRouteError } from '@remix-run/react';
import ErrorAnimation from './ErrorAnimation';

export function ErrorBoundary() {
  const error = useRouteError();

  const handleRetry = () => {
    window.location.reload();
  };

  return (
    <div className="flex items-center justify-center  px-6 py-12">
      <div className="max-w-xl w-full bg-white rounded-2xl text-center">
        <div className="flex items-center justify-center">
          <ErrorAnimation />
        </div>
        {isRouteErrorResponse(error) ? (
          <>
            <h1 className="text-2xl font-light m-0">{error.data}</h1>
          </>
        ) : error instanceof Error ? (
          <>
            <h1 className="text-2xl font-light m-0">Unexpected Error</h1>
            <p className="text-gray-600 mt-2 mb-4">{error.message}</p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-light m-0">Unknown Error</h1>
            <p className="text-gray-600 mt-2 mb-4">An unknown error occurred.</p>
          </>
        )}
        <button
          onClick={handleRetry}
          className="mt-6 px-6 py-2 bg-white border border-#4646B5 text-#4646B5 font-medium rounded-md hover:bg-gray-100 transition"
        >
          Retry
        </button>
      </div>
    </div>
  );
}
