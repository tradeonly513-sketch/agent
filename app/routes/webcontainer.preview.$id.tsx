import { json, type LoaderFunctionArgs } from '@remix-run/cloudflare';
import { useLoaderData } from '@remix-run/react';
import { useCallback, useEffect, useRef, useState } from 'react';

const PREVIEW_CHANNEL = 'preview-updates';

export async function loader({ params }: LoaderFunctionArgs) {
  const previewId = params.id;

  if (!previewId) {
    throw new Response('Preview ID is required', { status: 400 });
  }

  return json({ previewId });
}

export default function WebContainerPreview() {
  const { previewId } = useLoaderData<typeof loader>();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const broadcastChannelRef = useRef<BroadcastChannel>();
  const [previewUrl, setPreviewUrl] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Handle preview refresh
  const handleRefresh = useCallback(() => {
    if (iframeRef.current && previewUrl) {
      setIsLoading(true);

      // Force a clean reload
      iframeRef.current.src = '';
      requestAnimationFrame(() => {
        if (iframeRef.current) {
          iframeRef.current.src = previewUrl;
        }
      });
    }
  }, [previewUrl]);

  // Notify other tabs that this preview is ready
  const notifyPreviewReady = useCallback(() => {
    if (broadcastChannelRef.current && previewUrl) {
      broadcastChannelRef.current.postMessage({
        type: 'preview-ready',
        previewId,
        url: previewUrl,
        timestamp: Date.now(),
      });
    }
  }, [previewId, previewUrl]);

  // When the iframe has fully loaded, update the loading state and notify
  const handleIframeLoad = useCallback(() => {
    setIsLoading(false);
    notifyPreviewReady();
  }, [notifyPreviewReady]);

  useEffect(() => {
    // Initialize broadcast channel
    broadcastChannelRef.current = new BroadcastChannel(PREVIEW_CHANNEL);

    // Listen for preview updates
    broadcastChannelRef.current.onmessage = (event) => {
      if (event.data.previewId === previewId) {
        if (event.data.type === 'refresh-preview' || event.data.type === 'file-change') {
          setIsLoading(true);
          handleRefresh();
        }
      }
    };

    // Construct the WebContainer preview URL
    const url = `https://${previewId}.local-credentialless.webcontainer-api.io`;
    setPreviewUrl(url);

    // Set the iframe src if it's available
    if (iframeRef.current) {
      iframeRef.current.src = url;
    }

    // Cleanup broadcast channel on unmount
    return () => {
      broadcastChannelRef.current?.close();
    };
  }, [previewId, handleRefresh]);

  return (
    <div className="w-full h-full relative">
      {/* Loader shown while the iframe content is not yet loaded */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
          <span>Loading...</span>
        </div>
      )}
      <iframe
        ref={iframeRef}
        title="WebContainer Preview"
        className="w-full h-full border-none"
        sandbox="allow-scripts allow-forms allow-popups allow-modals allow-storage-access-by-user-activation allow-same-origin"
        allow="cross-origin-isolated"
        loading="eager"
        onLoad={handleIframeLoad}
      />
    </div>
  );
}
