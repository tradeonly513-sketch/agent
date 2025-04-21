import { useRouteError } from '@remix-run/react';
import { ErrorPage } from './ErrorPage';

export function ErrorBoundary() {
  const routeError = useRouteError();

  return <ErrorPage error={routeError} />;
}
