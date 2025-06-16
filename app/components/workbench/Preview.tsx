import { useStore } from '@nanostores/react';
import { memo, useEffect, useRef, useState } from 'react';
import { IconButton } from '~/components/ui/IconButton';
import { workbenchStore } from '~/lib/stores/workbench';
import { simulationReloaded } from '~/lib/replay/ChatManager';
import { PointSelector } from './PointSelector';
import { APP_SUMMARY_CATEGORY, parseAppSummaryMessage, type AppSummary } from '~/lib/persistence/messageAppSummary';
import { classNames } from '~/utils/classNames';
import type { Message } from '~/lib/persistence/message';

type ResizeSide = 'left' | 'right' | null;

let gCurrentIFrame: HTMLIFrameElement | undefined;

export function getCurrentIFrame() {
  return gCurrentIFrame;
}

interface PreviewProps {
  activeTab: 'planning' | 'testing' | 'preview';
  messages?: Message[];
}

export const Preview = memo(({ activeTab, messages }: PreviewProps) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [isPortDropdownOpen, setIsPortDropdownOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [url, setUrl] = useState('');
  const [iframeUrl, setIframeUrl] = useState<string | undefined>();
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectionPoint, setSelectionPoint] = useState<{ x: number; y: number } | null>(null);

  const previewURL = useStore(workbenchStore.previewURL);

  // Toggle between responsive mode and device mode
  const [isDeviceModeOn, setIsDeviceModeOn] = useState(false);

  // Use percentage for width
  const [widthPercent, setWidthPercent] = useState<number>(37.5); // 375px assuming 1000px window width initially

  const resizingState = useRef({
    isResizing: false,
    side: null as ResizeSide,
    startX: 0,
    startWidthPercent: 37.5,
    windowWidth: window.innerWidth,
  });

  // Define the scaling factor
  const SCALING_FACTOR = 2; // Adjust this value to increase/decrease sensitivity

  gCurrentIFrame = iframeRef.current ?? undefined;

  // Get the latest app summary from messages (use passed messages, not store)
  const getLatestAppSummary = (): AppSummary | null => {
    if (!messages) return null;
    
    // Find the last message with APP_SUMMARY_CATEGORY
    const appSummaryMessage = messages
      .slice()
      .reverse()
      .find(message => message.category === APP_SUMMARY_CATEGORY);
    
    if (!appSummaryMessage) return null;
    return parseAppSummaryMessage(appSummaryMessage) || null;
  };

  const appSummary = getLatestAppSummary();

  useEffect(() => {
    if (!previewURL) {
      setUrl('');
      setIframeUrl(undefined);
      setSelectionPoint(null);

      return;
    }

    setUrl(previewURL);
    setIframeUrl(previewURL);
  }, [previewURL]);

  const reloadPreview = () => {
    if (iframeRef.current) {
      simulationReloaded();
      iframeRef.current.src = iframeRef.current.src;
    }

    setIsSelectionMode(false);
    setSelectionPoint(null);
  };

  const toggleFullscreen = async () => {
    if (!isFullscreen && containerRef.current) {
      await containerRef.current.requestFullscreen();
    } else if (document.fullscreenElement) {
      await document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleDeviceMode = () => {
    setIsDeviceModeOn((prev) => !prev);
  };

  const startResizing = (e: React.MouseEvent, side: ResizeSide) => {
    if (!isDeviceModeOn) {
      return;
    }

    // Prevent text selection
    document.body.style.userSelect = 'none';

    resizingState.current.isResizing = true;
    resizingState.current.side = side;
    resizingState.current.startX = e.clientX;
    resizingState.current.startWidthPercent = widthPercent;
    resizingState.current.windowWidth = window.innerWidth;

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

    e.preventDefault(); // Prevent any text selection on mousedown
  };

  const onMouseMove = (e: MouseEvent) => {
    if (!resizingState.current.isResizing) {
      return;
    }

    const dx = e.clientX - resizingState.current.startX;
    const windowWidth = resizingState.current.windowWidth;

    // Apply scaling factor to increase sensitivity
    const dxPercent = (dx / windowWidth) * 100 * SCALING_FACTOR;

    let newWidthPercent = resizingState.current.startWidthPercent;

    if (resizingState.current.side === 'right') {
      newWidthPercent = resizingState.current.startWidthPercent + dxPercent;
    } else if (resizingState.current.side === 'left') {
      newWidthPercent = resizingState.current.startWidthPercent - dxPercent;
    }

    // Clamp the width between 10% and 90%
    newWidthPercent = Math.max(10, Math.min(newWidthPercent, 90));

    setWidthPercent(newWidthPercent);
  };

  const onMouseUp = () => {
    resizingState.current.isResizing = false;
    resizingState.current.side = null;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);

    // Restore text selection
    document.body.style.userSelect = '';
  };

  // Handle window resize to ensure widthPercent remains valid
  useEffect(() => {
    const handleWindowResize = () => {
      /*
       * Optional: Adjust widthPercent if necessary
       * For now, since widthPercent is relative, no action is needed
       */
    };

    window.addEventListener('resize', handleWindowResize);

    return () => {
      window.removeEventListener('resize', handleWindowResize);
    };
  }, []);

  // Component to render the planning view (description + features)
  const renderPlanningView = () => {
    if (!appSummary) {
      return (
        <div className="h-full overflow-auto bg-white p-6">
          <div className="max-w-4xl mx-auto">
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 mb-6 bg-bolt-elements-background-depth-2 rounded-full flex items-center justify-center">
                <div className="text-2xl">📋</div>
              </div>
              <div className="text-2xl font-bold mb-4 text-gray-900">Planning</div>
              <div className="text-gray-600 mb-8 max-w-md">
                Start planning your project by describing what you want to build. As you chat with the assistant, 
                your project description and features will appear here.
              </div>
              <div className="text-sm text-gray-500">
                💡 Try asking: "Help me build a todo app with React"
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="h-full overflow-auto bg-white p-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-2xl font-bold mb-6 text-gray-900">Planning</div>
          
          <div className="mb-8">
            <div className="text-lg font-semibold mb-3 text-gray-900">Project Description</div>
            <div className="text-gray-700 leading-relaxed">{appSummary.description}</div>
          </div>

          <div className="mb-8">
            <div className="text-lg font-semibold mb-4 text-gray-900">Features</div>
            <div className="space-y-6">
              {appSummary.features.map((feature) => {
                return (
                  <div key={feature.id} className="space-y-3">
                    {/* Feature */}
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                      <div
                        className={classNames('w-4 h-4 rounded-full border-2', {
                          'bg-gray-300 border-gray-400': !feature.done,
                          'bg-green-500 border-green-500': feature.done,
                        })}
                      />
                      <div className={classNames('flex-1', {
                        'text-gray-600': !feature.done,
                        'text-gray-900': feature.done,
                      })}>
                        {feature.description}
                      </div>
                      {feature.done && (
                        <div className="text-green-600 text-sm font-medium">✓ Complete</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Component to render the testing view (tests only)
  const renderTestingView = () => {
    if (!appSummary) return null;

    return (
      <div className="h-full overflow-auto bg-white p-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-2xl font-bold mb-6 text-gray-900">Testing</div>
          
          <div className="space-y-3">
            <div className="text-lg font-semibold mb-4 text-gray-900">Tests</div>
            <div className="space-y-2">
              {appSummary.tests.map((test, testIdx) => (
                <div key={testIdx} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                  <div
                    className={classNames('w-4 h-4 rounded-full border-2', {
                      'bg-green-500 border-green-500': test.status === 'Pass',
                      'bg-red-500 border-red-500': test.status === 'Fail',
                      'bg-gray-300 border-gray-400': test.status === 'NotRun',
                    })}
                  />
                  <div className="flex-1">
                    {test.recordingId ? (
                      <a
                        href={`https://app.replay.io/recording/${test.recordingId}`}
                        className={classNames('hover:underline')}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {test.title}
                      </a>
                    ) : (
                      <span>
                        {test.title}
                      </span>
                    )}
                  </div>
                  <div className={classNames('text-sm font-medium', {
                    'text-green-600': test.status === 'Pass',
                    'text-red-600': test.status === 'Fail',
                    'text-gray-500': test.status === 'NotRun',
                  })}>
                    {test.status === 'Pass' && '✓ Pass'}
                    {test.status === 'Fail' && '✗ Fail'}
                    {test.status === 'NotRun' && '○ Not Run'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const GripIcon = () => (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100%',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          color: 'rgba(0,0,0,0.5)',
          fontSize: '10px',
          lineHeight: '5px',
          userSelect: 'none',
          marginLeft: '1px',
        }}
      >
        ••• •••
      </div>
    </div>
  );

  return (
    <div ref={containerRef} className="w-full h-full flex flex-col relative">
      {isPortDropdownOpen && (
        <div className="z-iframe-overlay w-full h-full absolute" onClick={() => setIsPortDropdownOpen(false)} />
      )}
      <div className="bg-bolt-elements-background-depth-2 p-2 flex items-center gap-1.5">
        <IconButton icon="i-ph:arrow-clockwise" onClick={reloadPreview} />
        <IconButton
          icon="i-ph:bug-beetle"
          title="Point to Bug"
          onClick={() => {
            setSelectionPoint(null);
            setIsSelectionMode(!isSelectionMode);
          }}
          className={isSelectionMode ? 'bg-bolt-elements-background-depth-3' : ''}
        />
        <div
          className="flex items-center gap-1 flex-grow bg-bolt-elements-preview-addressBar-background border border-bolt-elements-borderColor text-bolt-elements-preview-addressBar-text rounded-full px-3 py-1 text-sm hover:bg-bolt-elements-preview-addressBar-backgroundHover hover:focus-within:bg-bolt-elements-preview-addressBar-backgroundActive focus-within:bg-bolt-elements-preview-addressBar-backgroundActive
        focus-within-border-bolt-elements-borderColorActive focus-within:text-bolt-elements-preview-addressBar-textActive"
        >
          <input
            title="URL"
            ref={inputRef}
            className="w-full bg-transparent outline-none"
            type="text"
            value={url}
            onChange={(event) => {
              setUrl(event.target.value);
            }}
            onKeyDown={(event) => {
              let newUrl;

              if (event.key === 'Enter') {
                setIframeUrl(newUrl);

                if (inputRef.current) {
                  inputRef.current.blur();
                }
              }
            }}
          />
        </div>

        {/* Device mode toggle button - only show in preview tab */}
        {activeTab === 'preview' && (
          <IconButton
            icon="i-ph:devices"
            onClick={toggleDeviceMode}
            title={isDeviceModeOn ? 'Switch to Responsive Mode' : 'Switch to Device Mode'}
          />
        )}

        {/* Fullscreen toggle button */}
        <IconButton
          icon={isFullscreen ? 'i-ph:arrows-in' : 'i-ph:arrows-out'}
          onClick={toggleFullscreen}
          title={isFullscreen ? 'Exit Full Screen' : 'Full Screen'}
        />
      </div>

      <div className="flex-1 border-t border-bolt-elements-borderColor flex justify-center items-center overflow-auto">
        {activeTab === 'planning' ? (
          renderPlanningView()
        ) : activeTab === 'testing' ? (
          renderTestingView()
        ) : (
          <div
            style={{
              width: isDeviceModeOn ? `${widthPercent}%` : '100%',
              height: '100%', // Always full height
              overflow: 'visible',
              background: '#fff',
              position: 'relative',
              display: 'flex',
            }}
          >
            {previewURL ? (
              <>
                <iframe
                  ref={iframeRef}
                  title="preview"
                  className="border-none w-full h-full bg-white"
                  src={iframeUrl}
                  allowFullScreen
                />
                <PointSelector
                  isSelectionMode={isSelectionMode}
                  setIsSelectionMode={setIsSelectionMode}
                  selectionPoint={selectionPoint}
                  setSelectionPoint={setSelectionPoint}
                  containerRef={iframeRef}
                />
              </>
            ) : (
              <div className="flex w-full h-full justify-center items-center bg-white">Preview loading...</div>
            )}

            {isDeviceModeOn && activeTab === 'preview' && (
              <>
                {/* Left handle */}
                <div
                  onMouseDown={(e) => startResizing(e, 'left')}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '15px',
                    marginLeft: '-15px',
                    height: '100%',
                    cursor: 'ew-resize',
                    background: 'rgba(255,255,255,.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'background 0.2s',
                    userSelect: 'none',
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,.5)')}
                  onMouseOut={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,.2)')}
                  title="Drag to resize width"
                >
                  <GripIcon />
                </div>

                {/* Right handle */}
                <div
                  onMouseDown={(e) => startResizing(e, 'right')}
                  style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    width: '15px',
                    marginRight: '-15px',
                    height: '100%',
                    cursor: 'ew-resize',
                    background: 'rgba(255,255,255,.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'background 0.2s',
                    userSelect: 'none',
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,.5)')}
                  onMouseOut={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,.2)')}
                  title="Drag to resize width"
                >
                  <GripIcon />
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
});
