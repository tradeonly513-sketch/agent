import { RemixBrowser } from '@remix-run/react';
import { startTransition } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { resourceOptimizer } from '~/lib/runtime/resource-optimizer';

// Initialize resource optimizer to reduce client load
if (typeof window !== 'undefined') {
  // Configure based on device capabilities
  const isLowEndDevice = navigator.hardwareConcurrency <= 2 || (navigator as any).deviceMemory <= 4;

  if (isLowEndDevice) {
    resourceOptimizer.updateConfig({
      maxConcurrentRequests: 2,
      requestDebounceMs: 500,
      webWorkerPoolSize: 1,
      enableProgressiveRendering: true,
    });
  }

  // Log resource stats periodically in debug mode
  if (localStorage.getItem('debug')?.includes('ResourceOptimizer')) {
    setInterval(() => {
      console.log('[ResourceOptimizer] Stats:', resourceOptimizer.getStats());
    }, 10000);
  }
}

startTransition(() => {
  hydrateRoot(document.getElementById('root')!, <RemixBrowser />);
});
