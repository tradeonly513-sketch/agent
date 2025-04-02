import { RemixBrowser } from '@remix-run/react';
import { startTransition } from 'react';
import { hydrateRoot } from 'react-dom/client';
import './utils/fetch';

startTransition(() => {
  hydrateRoot(document.getElementById('root')!, <RemixBrowser />);
});
