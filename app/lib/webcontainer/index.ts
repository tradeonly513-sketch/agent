import { WebContainer } from '@webcontainer/api';
import { WORK_DIR_NAME } from '~/utils/constants';
import { cleanStackTrace } from '~/utils/stacktrace';

interface WebContainerContext {
  loaded: boolean;
}

export const webcontainerContext: WebContainerContext = import.meta.hot?.data.webcontainerContext ?? {
  loaded: false,
};

if (import.meta.hot) {
  import.meta.hot.data.webcontainerContext = webcontainerContext;
}

export let webcontainer: Promise<WebContainer> = new Promise(() => {
  // noop for ssr
});

if (!import.meta.env.SSR) {
  webcontainer =
    import.meta.hot?.data.webcontainer ??
    Promise.resolve()
      .then(async () => {
        console.log('Starting WebContainer boot...');

        try {
          const wc = await WebContainer.boot({
            coep: 'credentialless',
            workdirName: WORK_DIR_NAME,
            forwardPreviewErrors: true, // Enable error forwarding from iframes
          });

          console.log('WebContainer booted successfully');
          return wc;
        } catch (error) {
          console.error('WebContainer boot failed:', error);

          // Retry with different configuration
          console.log('Retrying WebContainer boot with fallback configuration...');
          try {
            const wc = await WebContainer.boot({
              workdirName: WORK_DIR_NAME,
              forwardPreviewErrors: true,
            });
            console.log('WebContainer booted successfully with fallback configuration');
            return wc;
          } catch (retryError) {
            console.error('WebContainer boot retry failed:', retryError);
            throw new Error(`Failed to initialize WebContainer: ${retryError}`);
          }
        }
      })
      .then(async (webcontainer) => {
        webcontainerContext.loaded = true;

        try {
          const { workbenchStore } = await import('~/lib/stores/workbench');

          // Try to load inspector script with error handling
          try {
            const response = await fetch('/inspector-script.js');
            if (response.ok) {
              const inspectorScript = await response.text();
              await webcontainer.setPreviewScript(inspectorScript);
              console.log('Inspector script loaded successfully');
            } else {
              console.warn('Failed to load inspector script:', response.status);
            }
          } catch (inspectorError) {
            console.warn('Inspector script loading failed:', inspectorError);
          }

          // Listen for preview errors
          webcontainer.on('preview-message', (message) => {
            console.log('WebContainer preview message:', message);

            // Handle both uncaught exceptions and unhandled promise rejections
            if (message.type === 'PREVIEW_UNCAUGHT_EXCEPTION' || message.type === 'PREVIEW_UNHANDLED_REJECTION') {
              const isPromise = message.type === 'PREVIEW_UNHANDLED_REJECTION';
              const title = isPromise ? 'Unhandled Promise Rejection' : 'Uncaught Exception';
              workbenchStore.actionAlert.set({
                type: 'preview',
                title,
                description: 'message' in message ? message.message : 'Unknown error',
                content: `Error occurred at ${message.pathname}${message.search}${message.hash}\nPort: ${message.port}\n\nStack trace:\n${cleanStackTrace(message.stack || '')}`,
                source: 'preview',
              });
            }
          });

          console.log('WebContainer initialization completed successfully');
          return webcontainer;
        } catch (setupError) {
          console.error('WebContainer setup failed:', setupError);
          // Return the webcontainer even if setup fails
          return webcontainer;
        }
      })
      .catch((error) => {
        console.error('Critical WebContainer initialization failure:', error);
        webcontainerContext.loaded = false;
        throw error;
      });

  if (import.meta.hot) {
    import.meta.hot.data.webcontainer = webcontainer;
  }
}
