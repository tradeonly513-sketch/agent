import { isRouteErrorResponse } from '@remix-run/react';
import ErrorAnimation from './ErrorAnimation';

export function ErrorPage({ error }: { error: unknown }) {
  const handleRetry = () => {
    window.location.reload();
  };

  return (
    <div className="flex items-center justify-center px-6 py-12 z-1">
      <div className="max-w-xl w-full rounded-2xl text-center">
        <div className="flex items-center justify-center">
          <ErrorAnimation />
        </div>
        {isRouteErrorResponse(error) ? (
          <>
            <h1 className="text-2xl text-bolt-elements-textPrimary dark:text-white font-light m-0">{error.data}</h1>
          </>
        ) : error instanceof Error ? (
          <>
            <h1 className="text-bolt-elements-textPrimary dark:text-white font-black m-0">Unexpected Error</h1>
            <p className="text-bolt-elements-textPrimary dark:text-white mt-2 mb-4">{error.message}</p>
          </>
        ) : (
          <>
            <h1 className="text-bolt-elements-textPrimary dark:text-white font-light m-0">Unknown Error</h1>
            <p className="text-bolt-elements-textPrimary dark:text-white mt-2 mb-4">An unknown error occurred.</p>
          </>
        )}
        <button
          onClick={handleRetry}
          className="mt-6 px-6 py-2 bg-white dark:bg-[#252525] border border-[#4646B5] text-[#4646B5] dark:text-white font-medium rounded-md hover:bg-gray-100 dark:hover:bg-[#333333] transition"
        >
          Retry
        </button>
      </div>
    </div>
  );
}
