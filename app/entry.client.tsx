import { RemixBrowser } from '@remix-run/react';
import { startTransition } from 'react';
import { hydrateRoot } from 'react-dom/client';
import './utils/fetch';

// Create a loader element that will be shown until hydration is complete
const createLoader = () => {
  const loader = document.createElement('div');
  loader.id = 'hydration-loader';
  loader.style.position = 'fixed';
  loader.style.top = '0';
  loader.style.left = '0';
  loader.style.width = '100%';
  loader.style.height = '100%';
  loader.style.display = 'flex';
  loader.style.justifyContent = 'center';
  loader.style.alignItems = 'center';
  loader.style.backgroundColor = 'white';
  loader.style.zIndex = '9999';

  const spinner = document.createElement('div');
  spinner.style.width = '50px';
  spinner.style.height = '50px';
  spinner.style.border = '5px solid #f3f3f3';
  spinner.style.borderTop = '5px solid #3498db';
  spinner.style.borderRadius = '50%';
  spinner.style.animation = 'spin 1s linear infinite';

  const style = document.createElement('style');
  style.textContent = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;

  document.head.appendChild(style);
  loader.appendChild(spinner);
  document.body.appendChild(loader);

  return loader;
};

const loader = createLoader();

startTransition(() => {
  hydrateRoot(document.getElementById('root')!, <RemixBrowser />);

  setTimeout(() => {
    loader.remove();
  }, 500);
});
