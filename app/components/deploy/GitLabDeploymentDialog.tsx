import * as Dialog from '@radix-ui/react-dialog';
import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { motion } from 'framer-motion';
import { classNames } from '~/utils/classNames';
import { getLocalStorage } from '~/lib/persistence/localStorage';
import { logStore } from '~/lib/stores/logs';
import { chatId } from '~/lib/persistence/useChatHistory';
import { useStore } from '@nanostores/react';
import { SearchInput, Badge } from '~/components/ui';
import type { GitLabUserResponse, GitLabProjectInfo } from '~/types/GitLab';

interface GitLabDeploymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  projectName: string;
  files: Record<string, string>;
}

export function GitLabDeploymentDialog({ isOpen, onClose, projectName, files }: GitLabDeploymentDialogProps) {
  const [projectPath, setProjectPath] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<GitLabUserResponse | null>(null);
  const [recentProjects, setRecentProjects] = useState<GitLabProjectInfo[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<GitLabProjectInfo[]>([]);
  const [projectSearchQuery, setProjectSearchQuery] = useState('');
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [createdProjectUrl, setCreatedProjectUrl] = useState('');
  const currentChatId = useStore(chatId);

  // Load GitLab connection on mount
  useEffect(() => {
    if (isOpen) {
      const connection = getLocalStorage('gitlab_connection');

      // Set a default project path based on the project name
      setProjectPath(`${user?.username || 'user'}/${projectName.replace(/\s+/g, '-').toLowerCase()}`);

      if (connection?.user && connection?.token) {
        setUser(connection.user);

        // Only fetch if we have both user and token
        if (connection.token.trim()) {
          fetchRecentProjects(connection.token, connection.gitlabUrl || 'https://gitlab.com');
        }
      }
    }
  }, [isOpen, projectName, user?.username]);

  // Filter projects based on search query
  useEffect(() => {
    if (projectSearchQuery.trim()) {
      const filtered = recentProjects.filter(
        (project) =>
          project.name.toLowerCase().includes(projectSearchQuery.toLowerCase()) ||
          project.path_with_namespace.toLowerCase().includes(projectSearchQuery.toLowerCase()),
      );
      setFilteredProjects(filtered);
    } else {
      setFilteredProjects(recentProjects);
    }
  }, [projectSearchQuery, recentProjects]);

  const fetchRecentProjects = async (token: string, gitlabUrl: string) => {
    try {
      const response = await fetch(`${gitlabUrl}/api/v4/projects?membership=true&per_page=20`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch projects: ${response.status}`);
      }

      const projects = (await response.json()) as GitLabProjectInfo[];
      setRecentProjects(projects);
      setFilteredProjects(projects);
    } catch (error) {
      console.error('Failed to fetch GitLab projects:', error);
      toast.error('Failed to fetch your GitLab projects');
    } finally {
    }
  };

  const createNewProject = async (token: string, gitlabUrl: string) => {
    const [namespace, name] = projectPath.split('/');

    const response = await fetch(`${gitlabUrl}/api/v4/projects`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        path: name,
        namespace_id: namespace,
        visibility: isPrivate ? 'private' : 'public',
        description: `Project created from Bolt.diy chat ${currentChatId}`,
      }),
    });

    if (!response.ok) {
      const errorData = (await response.json()) as { message?: string };
      throw new Error(errorData.message || 'Failed to create project');
    }

    return await response.json();
  };

  const pushFilesToRepository = async (projectId: number, token: string, gitlabUrl: string) => {
    const fileEntries = Object.entries(files);
    const pushedFilesList: { path: string; size: number }[] = [];

    for (const [filePath, content] of fileEntries) {
      try {
        const response = await fetch(
          `${gitlabUrl}/api/v4/projects/${projectId}/repository/files/${encodeURIComponent(filePath)}`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              branch: 'main',
              content: btoa(unescape(encodeURIComponent(content))),
              encoding: 'base64',
              commit_message: `Add ${filePath}`,
            }),
          },
        );

        if (!response.ok) {
          console.warn(`Failed to push ${filePath}:`, await response.text());
          continue;
        }

        pushedFilesList.push({
          path: filePath,
          size: new Blob([content]).size,
        });
      } catch (error) {
        console.warn(`Error pushing ${filePath}:`, error);
        continue;
      }
    }

    return pushedFilesList;
  };

  const handleDeploy = async () => {
    if (!user) {
      toast.error('No GitLab user found');
      return;
    }

    const connection = getLocalStorage('gitlab_connection');

    if (!connection?.token) {
      toast.error('No GitLab token found');
      return;
    }

    setIsLoading(true);

    try {
      const gitlabUrl = connection.gitlabUrl || 'https://gitlab.com';
      let targetProject;

      // Check if project exists
      const projectResponse = await fetch(`${gitlabUrl}/api/v4/projects/${encodeURIComponent(projectPath)}`, {
        headers: {
          Authorization: `Bearer ${connection.token}`,
        },
      });

      if (projectResponse.ok) {
        targetProject = await projectResponse.json();
      } else {
        // Create new project
        targetProject = await createNewProject(connection.token, gitlabUrl);
        toast.success('New GitLab project created!');
      }

      const project = targetProject as any;

      // Push files to repository
      await pushFilesToRepository(project.id, connection.token, gitlabUrl);
      setCreatedProjectUrl(project.web_url);

      logStore.logInfo('GitLab deployment completed', {
        type: 'system',
        message: `Successfully deployed to GitLab project: ${project.name}`,
      });

      setShowSuccessDialog(true);
      toast.success('Successfully deployed to GitLab!');
    } catch (error) {
      console.error('GitLab deployment error:', error);
      toast.error(error instanceof Error ? error.message : 'Deployment failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setShowSuccessDialog(false);
    setCreatedProjectUrl('');
    onClose();
  };

  return (
    <>
      <Dialog.Root open={isOpen} onOpenChange={handleClose}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black bg-opacity-50 z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-bolt-elements-background-depth-2 rounded-lg shadow-xl z-50 w-full max-w-2xl max-h-[90vh] overflow-hidden">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex flex-col h-full max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-bolt-elements-borderColor">
                  <Dialog.Title className="text-lg font-semibold text-bolt-elements-textPrimary">
                    Deploy to GitLab
                  </Dialog.Title>
                  <Dialog.Close className="text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary">
                    <span className="sr-only">Close</span>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </Dialog.Close>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                  <div className="space-y-6">
                    {/* Project Info */}
                    <div>
                      <h3 className="text-sm font-medium text-bolt-elements-textPrimary mb-2">
                        Project: {projectName}
                      </h3>
                      <p className="text-xs text-bolt-elements-textSecondary">
                        {Object.keys(files).length} files ready to deploy
                      </p>
                    </div>

                    {/* Project Path Input */}
                    <div>
                      <label className="block text-sm font-medium text-bolt-elements-textPrimary mb-2">
                        GitLab Project Path
                      </label>
                      <input
                        type="text"
                        value={projectPath}
                        onChange={(e) => setProjectPath(e.target.value)}
                        placeholder="namespace/project-name"
                        className="w-full px-3 py-2 bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor rounded-md text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary focus:outline-none focus:ring-2 focus:ring-bolt-elements-button-primary-background"
                      />
                      <p className="text-xs text-bolt-elements-textSecondary mt-1">
                        Use format: username/project-name or group/project-name
                      </p>
                    </div>

                    {/* Privacy Setting */}
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="private"
                        checked={isPrivate}
                        onChange={(e) => setIsPrivate(e.target.checked)}
                        className="rounded border-bolt-elements-borderColor text-bolt-elements-button-primary-background focus:ring-bolt-elements-button-primary-background"
                      />
                      <label htmlFor="private" className="text-sm text-bolt-elements-textPrimary">
                        Private repository
                      </label>
                    </div>

                    {/* Recent Projects */}
                    {recentProjects.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-bolt-elements-textPrimary mb-2">Recent Projects</h4>
                        <SearchInput
                          value={projectSearchQuery}
                          onChange={(e) => setProjectSearchQuery(e.target.value)}
                          placeholder="Search projects..."
                          className="mb-4"
                        />
                        <div className="max-h-40 overflow-y-auto space-y-2">
                          {filteredProjects.map((project) => (
                            <div
                              key={project.id}
                              onClick={() => setProjectPath(project.path_with_namespace)}
                              className="p-3 bg-bolt-elements-background-depth-3 rounded-md cursor-pointer hover:bg-bolt-elements-item-backgroundActive border border-bolt-elements-borderColor"
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-sm font-medium text-bolt-elements-textPrimary">{project.name}</p>
                                  <p className="text-xs text-bolt-elements-textSecondary">
                                    {project.path_with_namespace}
                                  </p>
                                </div>
                                <Badge variant={project.visibility === 'private' ? 'secondary' : 'default'}>
                                  {project.visibility}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-6 border-t border-bolt-elements-borderColor">
                  <Dialog.Close asChild>
                    <button
                      className="px-4 py-2 text-sm text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary"
                      disabled={isLoading}
                    >
                      Cancel
                    </button>
                  </Dialog.Close>
                  <button
                    onClick={handleDeploy}
                    disabled={isLoading || !projectPath.trim()}
                    className={classNames(
                      'px-4 py-2 text-sm font-medium rounded-md',
                      'bg-bolt-elements-button-primary-background text-bolt-elements-button-primary-text hover:bg-bolt-elements-button-primary-backgroundHover',
                      'disabled:opacity-50 disabled:cursor-not-allowed',
                    )}
                  >
                    {isLoading ? 'Deploying...' : 'Deploy to GitLab'}
                  </button>
                </div>
              </div>
            </motion.div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Success Dialog */}
      <Dialog.Root open={showSuccessDialog} onOpenChange={handleClose}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black bg-opacity-50 z-50" />
          <Dialog.Content className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-bolt-elements-background-depth-2 rounded-lg shadow-xl z-50 w-full max-w-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex flex-col">
                <div className="p-6">
                  <div className="flex items-center justify-center mb-4">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                  <h3 className="text-lg font-semibold text-bolt-elements-textPrimary text-center mb-2">
                    Deployment Successful!
                  </h3>
                  <p className="text-sm text-bolt-elements-textSecondary text-center mb-4">
                    Your project has been deployed to GitLab
                  </p>
                  {createdProjectUrl && (
                    <a
                      href={createdProjectUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-bolt-elements-button-primary-background hover:underline block text-center"
                    >
                      View Project on GitLab
                    </a>
                  )}
                </div>
                <div className="flex justify-end p-4 border-t border-bolt-elements-borderColor">
                  <button
                    onClick={handleClose}
                    className="px-4 py-2 text-sm bg-bolt-elements-button-primary-background text-bolt-elements-button-primary-text rounded-md hover:bg-bolt-elements-button-primary-backgroundHover"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
