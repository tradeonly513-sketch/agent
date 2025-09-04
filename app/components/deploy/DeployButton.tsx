import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useStore } from '@nanostores/react';
import { netlifyConnection } from '~/lib/stores/netlify';
import { vercelConnection } from '~/lib/stores/vercel';
import { workbenchStore } from '~/lib/stores/workbench';
import { streamingState } from '~/lib/stores/streaming';
import { classNames } from '~/utils/classNames';
import { useState } from 'react';
import { NetlifyDeploymentLink } from '~/components/chat/NetlifyDeploymentLink.client';
import { VercelDeploymentLink } from '~/components/chat/VercelDeploymentLink.client';
import { useVercelDeploy } from '~/components/deploy/VercelDeploy.client';
import { useNetlifyDeploy } from '~/components/deploy/NetlifyDeploy.client';
import { useGitHubDeploy } from '~/components/deploy/GitHubDeploy.client';
import { GitHubDeploymentDialog } from '~/components/deploy/GitHubDeploymentDialog';
import { ChevronDown, Rocket, Loader2, Globe, Github, Cloud } from 'lucide-react';

interface DeployButtonProps {
  onVercelDeploy?: () => Promise<void>;
  onNetlifyDeploy?: () => Promise<void>;
  onGitHubDeploy?: () => Promise<void>;
}

export const DeployButton = ({ onVercelDeploy, onNetlifyDeploy, onGitHubDeploy }: DeployButtonProps) => {
  const netlifyConn = useStore(netlifyConnection);
  const vercelConn = useStore(vercelConnection);
  const [activePreviewIndex] = useState(0);
  const previews = useStore(workbenchStore.previews);
  const activePreview = previews[activePreviewIndex];
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployingTo, setDeployingTo] = useState<'netlify' | 'vercel' | 'github' | null>(null);
  const isStreaming = useStore(streamingState);
  const { handleVercelDeploy } = useVercelDeploy();
  const { handleNetlifyDeploy } = useNetlifyDeploy();
  const { handleGitHubDeploy } = useGitHubDeploy();
  const [showGitHubDeploymentDialog, setShowGitHubDeploymentDialog] = useState(false);
  const [githubDeploymentFiles, setGithubDeploymentFiles] = useState<Record<string, string> | null>(null);
  const [githubProjectName, setGithubProjectName] = useState('');

  const handleVercelDeployClick = async () => {
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

  const handleGitHubDeployClick = async () => {
    setIsDeploying(true);
    setDeployingTo('github');

    try {
      if (onGitHubDeploy) {
        await onGitHubDeploy();
      } else {
        const result = await handleGitHubDeploy();

        if (result && result.success && result.files) {
          setGithubDeploymentFiles(result.files);
          setGithubProjectName(result.projectName);
          setShowGitHubDeploymentDialog(true);
        }
      }
    } finally {
      setIsDeploying(false);
      setDeployingTo(null);
    }
  };

  return (
    <>
      <div className="inline-block">
        <DropdownMenu.Root>
          <DropdownMenu.Trigger
            disabled={isDeploying || !activePreview || isStreaming}
            className={classNames(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium',
              'bg-bolt-elements-button-primary-background',
              'text-bolt-elements-button-primary-text',
              'border border-bolt-elements-borderColor',
              'transition-theme duration-150',
              'hover:bg-bolt-elements-button-primary-backgroundHover',
              'hover:text-bolt-elements-item-contentAccent',
              'focus:outline-none focus:ring-2 focus:ring-bolt-elements-borderColorActive focus:ring-offset-1',
              'disabled:cursor-not-allowed disabled:opacity-50',
              'shrink-0',
            )}
          >
            {isDeploying ? (
              <Loader2 className="w-4 h-4 animate-spin text-bolt-elements-icon-primary" />
            ) : (
              <Rocket className="w-4 h-4 text-bolt-elements-icon-primary" />
            )}
            <span className="hidden sm:inline">{isDeploying ? `Deploying to ${deployingTo}...` : 'Deploy'}</span>
            <ChevronDown className="w-3 h-3 text-bolt-elements-icon-tertiary transition-transform duration-200" />
          </DropdownMenu.Trigger>

          <DropdownMenu.Content
            className={classNames(
              'min-w-[280px] z-50',
              'bg-bolt-elements-background-depth-2',
              'border border-bolt-elements-borderColor',
              'rounded-xl shadow-xl',
              'p-1',
              'animate-in fade-in-0 zoom-in-95 duration-200',
            )}
            sideOffset={8}
            align="end"
            alignOffset={-4}
          >
            <DropdownMenu.Item
              className={classNames(
                'flex items-center w-full px-3 py-2 text-sm rounded-lg',
                'text-bolt-elements-textPrimary',
                'hover:bg-bolt-elements-item-backgroundActive',
                'hover:text-bolt-elements-item-contentActive',
                'focus:bg-bolt-elements-item-backgroundActive',
                'focus:text-bolt-elements-item-contentActive',
                'cursor-pointer select-none outline-none',
                'transition-theme duration-150',
                'gap-3',
                {
                  'opacity-50 cursor-not-allowed': isDeploying || !activePreview || !netlifyConn.user,
                },
              )}
              disabled={isDeploying || !activePreview || !netlifyConn.user}
              onClick={handleNetlifyDeployClick}
            >
              <Globe className="w-5 h-5 flex-shrink-0 text-bolt-elements-icon-secondary" />
              <span className="flex-1 text-left">
                {!netlifyConn.user ? 'No Netlify Account Connected' : 'Deploy to Netlify'}
              </span>
              {netlifyConn.user && <NetlifyDeploymentLink />}
            </DropdownMenu.Item>

            <DropdownMenu.Item
              className={classNames(
                'flex items-center w-full px-3 py-2 text-sm rounded-lg',
                'text-bolt-elements-textPrimary',
                'hover:bg-bolt-elements-item-backgroundActive',
                'hover:text-bolt-elements-item-contentActive',
                'focus:bg-bolt-elements-item-backgroundActive',
                'focus:text-bolt-elements-item-contentActive',
                'cursor-pointer select-none outline-none',
                'transition-theme duration-150',
                'gap-3',
                {
                  'opacity-50 cursor-not-allowed': isDeploying || !activePreview || !vercelConn.user,
                },
              )}
              disabled={isDeploying || !activePreview || !vercelConn.user}
              onClick={handleVercelDeployClick}
            >
              <Rocket className="w-5 h-5 flex-shrink-0 text-bolt-elements-icon-secondary" />
              <span className="flex-1 text-left">
                {!vercelConn.user ? 'No Vercel Account Connected' : 'Deploy to Vercel'}
              </span>
              {vercelConn.user && <VercelDeploymentLink />}
            </DropdownMenu.Item>

            <DropdownMenu.Item
              className={classNames(
                'flex items-center w-full px-3 py-2 text-sm rounded-lg',
                'text-bolt-elements-textPrimary',
                'hover:bg-bolt-elements-item-backgroundActive',
                'hover:text-bolt-elements-item-contentActive',
                'focus:bg-bolt-elements-item-backgroundActive',
                'focus:text-bolt-elements-item-contentActive',
                'cursor-pointer select-none outline-none',
                'transition-theme duration-150',
                'gap-3',
                {
                  'opacity-50 cursor-not-allowed': isDeploying || !activePreview,
                },
              )}
              disabled={isDeploying || !activePreview}
              onClick={handleGitHubDeployClick}
            >
              <Github className="w-5 h-5 flex-shrink-0 text-bolt-elements-icon-secondary" />
              <span className="flex-1 text-left">Deploy to GitHub</span>
            </DropdownMenu.Item>

            <DropdownMenu.Item
              disabled
              className={classNames(
                'flex items-center w-full px-3 py-2 text-sm rounded-lg',
                'text-bolt-elements-textTertiary',
                'cursor-not-allowed select-none',
                'opacity-50',
                'gap-3',
              )}
            >
              <Cloud className="w-5 h-5 flex-shrink-0 text-bolt-elements-icon-secondary" />
              <span className="flex-1 text-left">Deploy to Cloudflare (Coming Soon)</span>
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      </div>

      {/* GitHub Deployment Dialog */}
      {showGitHubDeploymentDialog && githubDeploymentFiles && (
        <GitHubDeploymentDialog
          isOpen={showGitHubDeploymentDialog}
          onClose={() => setShowGitHubDeploymentDialog(false)}
          projectName={githubProjectName}
          files={githubDeploymentFiles}
        />
      )}
    </>
  );
};
