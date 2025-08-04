import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as Dialog from '@radix-ui/react-dialog';
import { useStore } from '@nanostores/react';
import { netlifyConnection, updateNetlifyConnection } from '~/lib/stores/netlify';
import { vercelConnection, updateVercelConnection } from '~/lib/stores/vercel';
import { workbenchStore } from '~/lib/stores/workbench';
import { streamingState } from '~/lib/stores/streaming';
import { classNames } from '~/utils/classNames';
import { useState } from 'react';
import { NetlifyDeploymentLink } from '~/components/chat/NetlifyDeploymentLink.client';
import { VercelDeploymentLink } from '~/components/chat/VercelDeploymentLink.client';
import { useVercelDeploy } from '~/components/deploy/VercelDeploy.client';
import { useNetlifyDeploy } from '~/components/deploy/NetlifyDeploy.client';
import { toast } from 'react-toastify';

interface DeployButtonProps {
  onVercelDeploy?: () => Promise<void>;
  onNetlifyDeploy?: () => Promise<void>;
}

interface ConnectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  provider: 'netlify' | 'vercel';
  onConnect: (token: string) => Promise<void>;
}

const ConnectionDialog = ({ isOpen, onClose, provider, onConnect }: ConnectionDialogProps) => {
  const [token, setToken] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = async () => {
    if (!token.trim()) {
      toast.error(`Please enter your ${provider === 'netlify' ? 'Netlify' : 'Vercel'} API token`);
      return;
    }

    setIsConnecting(true);
    try {
      await onConnect(token.trim());
      setToken('');
      onClose();
    } catch (error) {
      console.error(`Error connecting to ${provider}:`, error);
    } finally {
      setIsConnecting(false);
    }
  };

  const getInstructions = () => {
    if (provider === 'netlify') {
      return {
        title: 'Connect to Netlify',
        instructions: [
          '1. Go to your Netlify account settings',
          '2. Navigate to "User settings" → "Applications"',
          '3. Click "New access token"',
          '4. Give it a name and copy the token',
          '5. Paste the token below'
        ],
        tokenUrl: 'https://app.netlify.com/user/applications#personal-access-tokens'
      };
    } else {
      return {
        title: 'Connect to Vercel',
        instructions: [
          '1. Go to your Vercel account settings',
          '2. Navigate to "Tokens"', 
          '3. Click "Create Token"',
          '4. Give it a name and copy the token',
          '5. Paste the token below'
        ],
        tokenUrl: 'https://vercel.com/account/tokens'
      };
    }
  };

  const { title, instructions, tokenUrl } = getInstructions();

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content className="fixed top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%] bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-lg shadow-lg p-6 w-full max-w-md z-50">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <Dialog.Title className="text-lg font-semibold text-bolt-elements-textPrimary">
                {title}
              </Dialog.Title>
              <button
                onClick={onClose}
                className="text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary"
              >
                <div className="i-ph:x text-xl" />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-sm text-bolt-elements-textSecondary">
                To deploy your project, you need to connect your {provider === 'netlify' ? 'Netlify' : 'Vercel'} account.
              </p>
              
              <div className="bg-bolt-elements-background-depth-3 p-3 rounded text-xs text-bolt-elements-textSecondary">
                <div className="font-medium mb-2">Quick Setup:</div>
                <ol className="space-y-1">
                  {instructions.map((instruction, index) => (
                    <li key={index}>{instruction}</li>
                  ))}
                </ol>
              </div>

              <div className="flex justify-center">
                <a
                  href={tokenUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-1 bg-bolt-elements-button-secondary-background hover:bg-bolt-elements-button-secondary-backgroundHover text-bolt-elements-button-secondary-text rounded text-sm"
                >
                  <div className="i-ph:arrow-square-out" />
                  Get API Token
                </a>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-bolt-elements-textPrimary">
                  API Token
                </label>
                <input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder={`Enter your ${provider === 'netlify' ? 'Netlify' : 'Vercel'} API token`}
                  className="w-full px-3 py-2 bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor rounded text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary focus:outline-none focus:ring-2 focus:ring-accent-500"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleConnect();
                    }
                  }}
                />
              </div>

              <div className="flex gap-2 justify-end">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm bg-bolt-elements-button-secondary-background hover:bg-bolt-elements-button-secondary-backgroundHover text-bolt-elements-button-secondary-text rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConnect}
                  disabled={isConnecting || !token.trim()}
                  className="px-4 py-2 text-sm bg-bolt-elements-button-primary-background hover:bg-bolt-elements-button-primary-backgroundHover text-bolt-elements-button-primary-text rounded disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isConnecting ? 'Connecting...' : 'Connect'}
                </button>
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export const DeployButton = ({ onVercelDeploy, onNetlifyDeploy }: DeployButtonProps) => {
  const netlifyConn = useStore(netlifyConnection);
  const vercelConn = useStore(vercelConnection);
  const [activePreviewIndex] = useState(0);
  const previews = useStore(workbenchStore.previews);
  const activePreview = previews[activePreviewIndex];
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployingTo, setDeployingTo] = useState<'netlify' | 'vercel' | null>(null);
  const [connectionDialog, setConnectionDialog] = useState<'netlify' | 'vercel' | null>(null);
  const isStreaming = useStore(streamingState);
  const { handleVercelDeploy } = useVercelDeploy();
  const { handleNetlifyDeploy } = useNetlifyDeploy();

  const handleVercelConnect = async (token: string) => {
    try {
      // Verify the token by fetching user info
      const response = await fetch('https://api.vercel.com/v2/user', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const userData = await response.json();

      // Update the connection store
      updateVercelConnection({
        user: userData,
        token: token,
      });

      toast.success('Successfully connected to Vercel!');
    } catch (error) {
      console.error('Error connecting to Vercel:', error);
      toast.error(`Failed to connect to Vercel: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  };

  const handleNetlifyConnect = async (token: string) => {
    try {
      // Verify the token by fetching user info
      const response = await fetch('https://api.netlify.com/api/v1/user', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const userData = await response.json();

      // Update the connection store
      updateNetlifyConnection({
        user: userData,
        token: token,
      });

      toast.success('Successfully connected to Netlify!');
    } catch (error) {
      console.error('Error connecting to Netlify:', error);
      toast.error(`Failed to connect to Netlify: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  };

  const handleVercelDeployClick = async () => {
    if (!vercelConn.user) {
      setConnectionDialog('vercel');
      return;
    }

    setIsDeploying(true);
    setDeployingTo('vercel');

    try {
      if (onVercelDeploy) {
        await onVercelDeploy();
      } else {
        await handleVercelDeploy();
      }
    } finally {
      setIsDeploying(false);
      setDeployingTo(null);
    }
  };

  const handleNetlifyDeployClick = async () => {
    if (!netlifyConn.user) {
      setConnectionDialog('netlify');
      return;
    }

    setIsDeploying(true);
    setDeployingTo('netlify');

    try {
      if (onNetlifyDeploy) {
        await onNetlifyDeploy();
      } else {
        await handleNetlifyDeploy();
      }
    } finally {
      setIsDeploying(false);
      setDeployingTo(null);
    }
  };

  return (
    <>
      <div className="flex border border-bolt-elements-borderColor rounded-md overflow-hidden text-sm">
        <DropdownMenu.Root>
          <DropdownMenu.Trigger
            disabled={isDeploying || !activePreview || isStreaming}
            className="rounded-md items-center justify-center [&:is(:disabled,.disabled)]:cursor-not-allowed [&:is(:disabled,.disabled)]:opacity-60 px-3 py-1.5 text-xs bg-accent-500 text-white hover:text-bolt-elements-item-contentAccent [&:not(:disabled,.disabled)]:hover:bg-bolt-elements-button-primary-backgroundHover outline-accent-500 flex gap-1.7"
          >
            {isDeploying ? `Deploying to ${deployingTo}...` : 'Deploy'}
            <span className={classNames('i-ph:caret-down transition-transform')} />
          </DropdownMenu.Trigger>
          <DropdownMenu.Content
            className={classNames(
              'z-[250]',
              'bg-bolt-elements-background-depth-2',
              'rounded-lg shadow-lg',
              'border border-bolt-elements-borderColor',
              'animate-in fade-in-0 zoom-in-95',
              'py-1',
            )}
            sideOffset={5}
            align="end"
          >
            <DropdownMenu.Item
              className={classNames(
                'cursor-pointer flex items-center w-full px-4 py-2 text-sm text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive gap-2 rounded-md group relative',
                {
                  'opacity-60 cursor-not-allowed': isDeploying || !activePreview,
                },
              )}
              disabled={isDeploying || !activePreview}
              onClick={handleNetlifyDeployClick}
            >
              <img
                className="w-5 h-5"
                height="24"
                width="24"
                crossOrigin="anonymous"
                src="https://cdn.simpleicons.org/netlify"
              />
              <span className="mx-auto">
                {!netlifyConn.user ? 'Connect & Deploy to Netlify' : 'Deploy to Netlify'}
              </span>
              {netlifyConn.user && <NetlifyDeploymentLink />}
            </DropdownMenu.Item>

            <DropdownMenu.Item
              className={classNames(
                'cursor-pointer flex items-center w-full px-4 py-2 text-sm text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive gap-2 rounded-md group relative',
                {
                  'opacity-60 cursor-not-allowed': isDeploying || !activePreview,
                },
              )}
              disabled={isDeploying || !activePreview}
              onClick={handleVercelDeployClick}
            >
              <img
                className="w-5 h-5 bg-black p-1 rounded"
                height="24"
                width="24"
                crossOrigin="anonymous"
                src="https://cdn.simpleicons.org/vercel/white"
                alt="vercel"
              />
              <span className="mx-auto">
                {!vercelConn.user ? 'Connect & Deploy to Vercel' : 'Deploy to Vercel'}
              </span>
              {vercelConn.user && <VercelDeploymentLink />}
            </DropdownMenu.Item>

            <DropdownMenu.Item
              disabled
              className="flex items-center w-full rounded-md px-4 py-2 text-sm text-bolt-elements-textTertiary gap-2 opacity-60 cursor-not-allowed"
            >
              <img
                className="w-5 h-5"
                height="24"
                width="24"
                crossOrigin="anonymous"
                src="https://cdn.simpleicons.org/cloudflare"
                alt="cloudflare"
              />
              <span className="mx-auto">Deploy to Cloudflare (Coming Soon)</span>
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      </div>

      {/* Connection Dialogs */}
      {connectionDialog && (
        <ConnectionDialog
          isOpen={true}
          onClose={() => setConnectionDialog(null)}
          provider={connectionDialog}
          onConnect={connectionDialog === 'netlify' ? handleNetlifyConnect : handleVercelConnect}
        />
      )}
    </>
  );
};
