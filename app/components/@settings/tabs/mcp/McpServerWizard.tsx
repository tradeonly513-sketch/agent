import { useState, useMemo, useEffect } from 'react';
import * as RadixDialog from '@radix-ui/react-dialog';
import { Dialog, DialogTitle } from '~/components/ui/Dialog';

// Helper function to sanitize config for UI display
function sanitizeConfigForDisplay(config: any): any {
  const sanitized = { ...config };

  // Sanitize environment variables
  if (sanitized.env) {
    sanitized.env = {};

    for (const [key, value] of Object.entries(config.env)) {
      if (isSensitiveEnvVar(key)) {
        sanitized.env[key] = '[REDACTED]';
      } else {
        sanitized.env[key] = value;
      }
    }
  }

  // Sanitize headers
  if (sanitized.headers) {
    sanitized.headers = {};

    for (const [key, value] of Object.entries(config.headers)) {
      if (isSensitiveHeader(key)) {
        sanitized.headers[key] = '[REDACTED]';
      } else {
        sanitized.headers[key] = value;
      }
    }
  }

  return sanitized;
}

function isSensitiveEnvVar(key: string): boolean {
  const sensitivePatterns = [
    /api[_-]?key/i,
    /secret/i,
    /token/i,
    /password/i,
    /auth/i,
    /credential/i,
    /bearer/i,
    /authorization/i,
    /private[_-]?key/i,
    /access[_-]?token/i,
    /refresh[_-]?token/i,
  ];
  return sensitivePatterns.some((pattern) => pattern.test(key));
}

function isSensitiveHeader(key: string): boolean {
  const sensitivePatterns = [/authorization/i, /api[_-]?key/i, /bearer/i, /token/i, /secret/i];
  return sensitivePatterns.some((pattern) => pattern.test(key));
}
import { Button } from '~/components/ui/Button';
import { Input } from '~/components/ui/Input';
import { Textarea } from '~/components/ui/Textarea';
import { Label } from '~/components/ui/Label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/Card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/Tabs';
import { Badge } from '~/components/ui/Badge';
import {
  Plus,
  Server,
  Globe,
  Terminal,
  Zap,
  FileText,
  Search,
  Database,
  Brain,
  MessageSquare,
  Cloud,
  Github,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Loader2,
  AlertCircle,
  X,
} from 'lucide-react';
import type { MCPServerConfig } from '~/lib/services/mcpService';

// Progress indicator component
const ProgressIndicator = ({ currentStep }: { currentStep: number }) => {
  const steps = [
    { label: 'Choose Template', description: 'Select or create server' },
    { label: 'Configure', description: 'Set up authentication' },
    { label: 'Review', description: 'Finalize and add' },
  ];

  return (
    <div className="mb-8 flex-shrink-0">
      <div className="flex items-center justify-between mb-4">
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const isActive = stepNumber === currentStep;
          const isCompleted = stepNumber < currentStep;

          return (
            <div key={step.label} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                    isCompleted
                      ? 'bg-green-500 text-white'
                      : isActive
                        ? 'bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent'
                        : 'bg-bolt-elements-background-depth-2 text-bolt-elements-textSecondary'
                  }`}
                >
                  {isCompleted ? <CheckCircle className="w-4 h-4" /> : stepNumber}
                </div>
                <div className="text-center mt-2">
                  <p
                    className={`text-xs font-medium ${isActive ? 'text-bolt-elements-textPrimary' : 'text-bolt-elements-textSecondary'}`}
                  >
                    {step.label}
                  </p>
                  <p className="text-xs text-bolt-elements-textSecondary hidden sm:block">{step.description}</p>
                </div>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`flex-1 h-px mx-4 transition-colors ${
                    isCompleted ? 'bg-green-500' : 'bg-bolt-elements-borderColor'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Search component
const SearchBar = ({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) => {
  return (
    <div className="relative mb-4">
      <Search
        className="absolute left-3 top-1/2 transform -translate-y-1/2 text-bolt-elements-textSecondary w-4 h-4"
        aria-hidden="true"
      />
      <Input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-10 pr-10"
        aria-label="Search MCP servers"
        role="searchbox"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary"
          aria-label="Clear search"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
};

const SERVER_TEMPLATES = {
  stdio: [
    {
      id: 'everything',
      name: 'Everything Server',
      description: 'Comprehensive MCP server with multiple tools - great for testing',
      category: 'General',
      icon: <Zap className="w-5 h-5" />,
      config: {
        type: 'stdio' as const,
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-everything'],
      },
      tags: ['verified', 'popular', 'multi-tool', 'no-auth'],
      status: 'verified',
      requiresAuth: false,
    },
    {
      id: 'filesystem',
      name: 'Filesystem Server',
      description: 'Access and manipulate local files and directories',
      category: 'Files',
      icon: <FileText className="w-5 h-5" />,
      config: {
        type: 'stdio' as const,
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem'],
      },
      tags: ['verified', 'files', 'local', 'no-auth'],
      status: 'verified',
      requiresAuth: false,
    },
    {
      id: 'memory',
      name: 'Memory Server',
      description: 'Persistent memory and knowledge storage',
      category: 'AI',
      icon: <Brain className="w-5 h-5" />,
      config: {
        type: 'stdio' as const,
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-memory'],
      },
      tags: ['verified', 'memory', 'ai', 'storage', 'no-auth'],
      status: 'verified',
      requiresAuth: false,
    },
    {
      id: 'postgres',
      name: 'PostgreSQL Server',
      description: 'Connect and query PostgreSQL databases',
      category: 'Database',
      icon: <Database className="w-5 h-5" />,
      config: {
        type: 'stdio' as const,
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-postgres'],
      },
      tags: ['verified', 'database', 'sql', 'postgres', 'requires-setup'],
      status: 'verified',
      requiresAuth: true,
      authNote: 'Requires PostgreSQL database credentials',
    },
    {
      id: 'github',
      name: 'GitHub Server',
      description: 'GitHub repository and issue management',
      category: 'Development',
      icon: <Github className="w-5 h-5" />,
      config: {
        type: 'stdio' as const,
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-github'],
      },
      tags: ['verified', 'github', 'git', 'issues', 'requires-auth'],
      status: 'verified',
      requiresAuth: true,
      authNote: 'Requires GitHub Personal Access Token',
    },
    {
      id: 'puppeteer',
      name: 'Puppeteer Server',
      description: 'Web scraping and browser automation',
      category: 'Web',
      icon: <Globe className="w-5 h-5" />,
      config: {
        type: 'stdio' as const,
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-puppeteer'],
      },
      tags: ['verified', 'scraping', 'automation', 'browser', 'no-auth'],
      status: 'verified',
      requiresAuth: false,
    },
    {
      id: 'slack',
      name: 'Slack Server',
      description: 'Slack workspace and messaging integration',
      category: 'Communication',
      icon: <MessageSquare className="w-5 h-5" />,
      config: {
        type: 'stdio' as const,
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-slack'],
      },
      tags: ['verified', 'slack', 'messaging', 'communication', 'requires-auth'],
      status: 'verified',
      requiresAuth: true,
      authNote: 'Requires Slack Bot Token',
    },
    {
      id: 'gdrive',
      name: 'Google Drive Server',
      description: 'Google Drive file management and operations',
      category: 'Cloud',
      icon: <Cloud className="w-5 h-5" />,
      config: {
        type: 'stdio' as const,
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-gdrive'],
      },
      tags: ['verified', 'google', 'drive', 'cloud', 'files', 'requires-auth'],
      status: 'verified',
      requiresAuth: true,
      authNote: 'Requires Google OAuth credentials',
    },
  ],
  http: [
    {
      id: 'deepwiki',
      name: 'DeepWiki Server',
      description: 'Access Wikipedia and knowledge base functionality',
      category: 'Knowledge',
      icon: <Search className="w-5 h-5" />,
      config: {
        type: 'streamable-http' as const,
        url: 'https://mcp.deepwiki.com/mcp',
      },
      tags: ['verified', 'wikipedia', 'search', 'no-auth'],
      status: 'verified',
      requiresAuth: false,
    },
    {
      id: 'exa-search',
      name: 'Exa Web Search',
      description: 'Advanced web search with Exa (formerly Metaphor)',
      category: 'Web',
      icon: <Search className="w-5 h-5" />,
      config: {
        type: 'streamable-http' as const,
        url: 'https://mcp.exa.ai/search',
      },
      tags: ['verified', 'search', 'web', 'ai', 'semantic', 'requires-auth'],
      status: 'verified',
      requiresAuth: true,
      authNote: 'Requires Exa API key',
    },
    {
      id: 'brave-search',
      name: 'Brave Search',
      description: 'Privacy-focused web search with Brave Search API',
      category: 'Web',
      icon: <Search className="w-5 h-5" />,
      config: {
        type: 'stdio' as const,
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-brave-search'],
      },
      tags: ['verified', 'search', 'web', 'privacy', 'requires-auth'],
      status: 'verified',
      requiresAuth: true,
      authNote: 'Requires Brave Search API key',
    },
    {
      id: 'sqlite',
      name: 'SQLite Server',
      description: 'Local SQLite database operations and queries',
      category: 'Database',
      icon: <Database className="w-5 h-5" />,
      config: {
        type: 'stdio' as const,
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-sqlite'],
      },
      tags: ['verified', 'database', 'sqlite', 'local', 'no-auth'],
      status: 'verified',
      requiresAuth: false,
    },
    {
      id: 'git',
      name: 'Git Server',
      description: 'Git repository operations and version control',
      category: 'Development',
      icon: <Terminal className="w-5 h-5" />,
      config: {
        type: 'stdio' as const,
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-git'],
      },
      tags: ['verified', 'git', 'version-control', 'development', 'no-auth'],
      status: 'verified',
      requiresAuth: false,
    },
    {
      id: 'hacker-news',
      name: 'Hacker News',
      description: 'Access Hacker News articles and discussions',
      category: 'Knowledge',
      icon: <FileText className="w-5 h-5" />,
      config: {
        type: 'stdio' as const,
        command: 'npx',
        args: ['-y', '@punkpeye/hacker-news-mcp'],
      },
      tags: ['verified', 'news', 'tech', 'discussions', 'no-auth'],
      status: 'verified',
      requiresAuth: false,
    },
    {
      id: 'qdrant',
      name: 'Qdrant Vector Search',
      description: 'Vector similarity search with Qdrant database',
      category: 'AI',
      icon: <Brain className="w-5 h-5" />,
      config: {
        type: 'stdio' as const,
        command: 'npx',
        args: ['-y', '@qdrant/mcp-server'],
      },
      tags: ['verified', 'vector-search', 'ai', 'embeddings', 'no-auth'],
      status: 'verified',
      requiresAuth: false,
    },
    {
      id: 'kubernetes',
      name: 'Kubernetes Server',
      description: 'Kubernetes cluster management and operations',
      category: 'DevOps',
      icon: <Server className="w-5 h-5" />,
      config: {
        type: 'stdio' as const,
        command: 'npx',
        args: ['-y', '@kubernetes/mcp-server'],
      },
      tags: ['verified', 'kubernetes', 'containers', 'devops', 'requires-auth'],
      status: 'verified',
      requiresAuth: true,
      authNote: 'Requires Kubernetes cluster access',
    },
    {
      id: 'elasticsearch',
      name: 'Elasticsearch Server',
      description: 'Search and analytics with Elasticsearch',
      category: 'Database',
      icon: <Search className="w-5 h-5" />,
      config: {
        type: 'stdio' as const,
        command: 'npx',
        args: ['-y', '@elastic/mcp-server'],
      },
      tags: ['verified', 'search', 'analytics', 'elasticsearch', 'requires-auth'],
      status: 'verified',
      requiresAuth: true,
      authNote: 'Requires Elasticsearch cluster access',
    },
    {
      id: 'weather',
      name: 'Weather Server',
      description: 'Weather data and forecasts from various providers',
      category: 'Utilities',
      icon: <Cloud className="w-5 h-5" />,
      config: {
        type: 'stdio' as const,
        command: 'npx',
        args: ['-y', '@weather/mcp-server'],
      },
      tags: ['verified', 'weather', 'forecast', 'utilities', 'requires-auth'],
      status: 'verified',
      requiresAuth: true,
      authNote: 'Requires weather API key (OpenWeatherMap, etc.)',
    },
    {
      id: 'sentry',
      name: 'Sentry Error Tracking',
      description: 'Access Sentry error tracking and monitoring data',
      category: 'Monitoring',
      icon: <Server className="w-5 h-5" />,
      config: {
        type: 'stdio' as const,
        command: 'npx',
        args: ['-y', '@sentry/mcp-server'],
      },
      tags: ['verified', 'monitoring', 'errors', 'logging', 'requires-auth'],
      status: 'verified',
      requiresAuth: true,
      authNote: 'Requires Sentry API token',
    },
    {
      id: 'twitter',
      name: 'Twitter/X API',
      description: 'Access Twitter/X posts, search, and user data',
      category: 'Social',
      icon: <MessageSquare className="w-5 h-5" />,
      config: {
        type: 'stdio' as const,
        command: 'npx',
        args: ['-y', '@twitter/mcp-server'],
      },
      tags: ['verified', 'social', 'twitter', 'api', 'requires-auth'],
      status: 'verified',
      requiresAuth: true,
      authNote: 'Requires Twitter API v2 Bearer Token',
    },
    {
      id: 'reddit',
      name: 'Reddit API',
      description: 'Access Reddit posts, comments, and communities',
      category: 'Social',
      icon: <MessageSquare className="w-5 h-5" />,
      config: {
        type: 'stdio' as const,
        command: 'npx',
        args: ['-y', '@reddit/mcp-server'],
      },
      tags: ['verified', 'social', 'reddit', 'api', 'requires-auth'],
      status: 'verified',
      requiresAuth: true,
      authNote: 'Requires Reddit API credentials',
    },
    {
      id: 'youtube',
      name: 'YouTube API',
      description: 'Search and access YouTube videos and channels',
      category: 'Media',
      icon: <Terminal className="w-5 h-5" />,
      config: {
        type: 'stdio' as const,
        command: 'npx',
        args: ['-y', '@youtube/mcp-server'],
      },
      tags: ['verified', 'media', 'youtube', 'video', 'requires-auth'],
      status: 'verified',
      requiresAuth: true,
      authNote: 'Requires YouTube Data API v3 key',
    },
    {
      id: 'openai',
      name: 'OpenAI API',
      description: 'Access OpenAI models, completions, and embeddings',
      category: 'AI',
      icon: <Brain className="w-5 h-5" />,
      config: {
        type: 'stdio' as const,
        command: 'npx',
        args: ['-y', '@openai/mcp-server'],
      },
      tags: ['verified', 'ai', 'openai', 'gpt', 'embeddings', 'requires-auth'],
      status: 'verified',
      requiresAuth: true,
      authNote: 'Requires OpenAI API key',
    },
    {
      id: 'anthropic',
      name: 'Anthropic Claude',
      description: 'Access Anthropic Claude models and completions',
      category: 'AI',
      icon: <Brain className="w-5 h-5" />,
      config: {
        type: 'stdio' as const,
        command: 'npx',
        args: ['-y', '@anthropic/mcp-server'],
      },
      tags: ['verified', 'ai', 'anthropic', 'claude', 'requires-auth'],
      status: 'verified',
      requiresAuth: true,
      authNote: 'Requires Anthropic API key',
    },
    {
      id: 'perplexity',
      name: 'Perplexity AI',
      description: 'Advanced AI-powered search and research',
      category: 'AI',
      icon: <Search className="w-5 h-5" />,
      config: {
        type: 'stdio' as const,
        command: 'npx',
        args: ['-y', '@perplexity/mcp-server'],
      },
      tags: ['verified', 'ai', 'search', 'research', 'requires-auth'],
      status: 'verified',
      requiresAuth: true,
      authNote: 'Requires Perplexity API key',
    },
    {
      id: 'replicate',
      name: 'Replicate AI',
      description: 'Access to thousands of AI models for various tasks',
      category: 'AI',
      icon: <Brain className="w-5 h-5" />,
      config: {
        type: 'stdio' as const,
        command: 'npx',
        args: ['-y', '@replicate/mcp-server'],
      },
      tags: ['verified', 'ai', 'models', 'inference', 'requires-auth'],
      status: 'verified',
      requiresAuth: true,
      authNote: 'Requires Replicate API token',
    },
    {
      id: 'mem0-coding',
      name: 'Mem0 Coding Assistant',
      description: 'Manage coding preferences, patterns, and best practices',
      category: 'Development',
      icon: <Brain className="w-5 h-5" />,
      config: {
        type: 'stdio' as const,
        command: 'npx',
        args: ['-y', '@mem0ai/mem0-mcp'],
      },
      tags: ['verified', 'coding', 'preferences', 'patterns', 'best-practices', 'no-auth'],
      status: 'verified',
      requiresAuth: false,
    },
    {
      id: 'devstandards',
      name: 'DevStandards MCP',
      description: 'Access development best practices, security guidelines, and coding standards',
      category: 'Development',
      icon: <Terminal className="w-5 h-5" />,
      config: {
        type: 'stdio' as const,
        command: 'npx',
        args: ['-y', '@ivangrynenko/devstandards_mcp'],
      },
      tags: ['verified', 'standards', 'security', 'best-practices', 'no-auth'],
      status: 'verified',
      requiresAuth: false,
    },
    {
      id: 'code-runner',
      name: 'Code Runner MCP',
      description: 'Execute code locally via Docker in multiple programming languages',
      category: 'Development',
      icon: <Terminal className="w-5 h-5" />,
      config: {
        type: 'stdio' as const,
        command: 'npx',
        args: ['-y', '@axliupore/mcp-code-runner'],
      },
      tags: ['verified', 'code-execution', 'docker', 'multi-language', 'no-auth'],
      status: 'verified',
      requiresAuth: false,
    },
    {
      id: 'vscode-mcp',
      name: 'VS Code MCP Server',
      description: 'Interact with VS Code workspace, files, and editor capabilities',
      category: 'Development',
      icon: <Terminal className="w-5 h-5" />,
      config: {
        type: 'stdio' as const,
        command: 'npx',
        args: ['-y', '@juehang/vscode-mcp-server'],
      },
      tags: ['verified', 'vscode', 'workspace', 'files', 'editor', 'no-auth'],
      status: 'verified',
      requiresAuth: false,
    },
    {
      id: 'xcode-mcp',
      name: 'Xcode MCP Server',
      description: 'Xcode project management, file operations, and build automation',
      category: 'Development',
      icon: <Terminal className="w-5 h-5" />,
      config: {
        type: 'stdio' as const,
        command: 'npx',
        args: ['-y', '@r-huijts/xcode-mcp-server'],
      },
      tags: ['verified', 'xcode', 'ios', 'macos', 'build', 'no-auth'],
      status: 'verified',
      requiresAuth: false,
    },
    {
      id: 'context7-docs',
      name: 'Context7 Documentation',
      description: 'Up-to-date code documentation for AI code editors',
      category: 'Development',
      icon: <FileText className="w-5 h-5" />,
      config: {
        type: 'stdio' as const,
        command: 'npx',
        args: ['-y', '@context7/server'],
      },
      tags: ['verified', 'documentation', 'code-docs', 'ai-editor', 'no-auth'],
      status: 'verified',
      requiresAuth: false,
    },
    {
      id: 'shrimp-task-manager',
      name: 'Shrimp Task Manager',
      description: 'Programming-focused task management with memory and dependencies',
      category: 'Development',
      icon: <Terminal className="w-5 h-5" />,
      config: {
        type: 'stdio' as const,
        command: 'npx',
        args: ['-y', '@cjo4m06/mcp-shrimp-task-manager'],
      },
      tags: ['verified', 'task-management', 'coding', 'memory', 'dependencies', 'no-auth'],
      status: 'verified',
      requiresAuth: false,
    },
    {
      id: 'sonarqube',
      name: 'SonarQube Code Quality',
      description: 'Code quality metrics, issues, and quality gate status',
      category: 'Development',
      icon: <Terminal className="w-5 h-5" />,
      config: {
        type: 'stdio' as const,
        command: 'npx',
        args: ['-y', '@sonarsource/sonarqube-mcp'],
      },
      tags: ['verified', 'code-quality', 'metrics', 'issues', 'requires-auth'],
      status: 'verified',
      requiresAuth: true,
      authNote: 'Requires SonarQube server access',
    },
    {
      id: 'semgrep-security',
      name: 'Semgrep Security Scanner',
      description: 'Scan code for security vulnerabilities and bugs',
      category: 'Development',
      icon: <Terminal className="w-5 h-5" />,
      config: {
        type: 'stdio' as const,
        command: 'npx',
        args: ['-y', '@semgrep/mcp-server'],
      },
      tags: ['verified', 'security', 'vulnerabilities', 'scanning', 'no-auth'],
      status: 'verified',
      requiresAuth: false,
    },
    {
      id: 'jupyter-mcp',
      name: 'Jupyter Notebook MCP',
      description: 'Real-time interaction with Jupyter notebooks for code editing and execution',
      category: 'Development',
      icon: <Terminal className="w-5 h-5" />,
      config: {
        type: 'stdio' as const,
        command: 'npx',
        args: ['-y', '@datalayer/jupyter-mcp-server'],
      },
      tags: ['verified', 'jupyter', 'notebook', 'data-science', 'python', 'no-auth'],
      status: 'verified',
      requiresAuth: false,
    },
    {
      id: 'mcp-git-ingest',
      name: 'Git Repository Analyzer',
      description: 'Use LLM to read and analyze GitHub repositories',
      category: 'Development',
      icon: <Terminal className="w-5 h-5" />,
      config: {
        type: 'stdio' as const,
        command: 'npx',
        args: ['-y', '@adhikasp/mcp-git-ingest'],
      },
      tags: ['verified', 'git', 'github', 'analysis', 'llm', 'no-auth'],
      status: 'verified',
      requiresAuth: false,
    },
  ],
};

const CATEGORIES = [
  'All',
  'General',
  'Files',
  'Development',
  'Database',
  'Web',
  'Knowledge',
  'Cloud',
  'AI',
  'Communication',
  'DevOps',
  'Utilities',
  'Monitoring',
  'Social',
  'Media',
];

const getCategoryIcon = (category: string): string => {
  switch (category) {
    case 'All':
      return '📋 All';
    case 'AI':
      return '🤖 AI';
    case 'Development':
      return '💻 Dev';
    case 'Database':
      return '🗄️ DB';
    case 'Web':
      return '🌐 Web';
    case 'Social':
      return '👥 Social';
    case 'Media':
      return '📺 Media';
    case 'DevOps':
      return '⚙️ DevOps';
    case 'Utilities':
      return '🛠️ Utils';
    case 'Monitoring':
      return '📊 Monitor';
    case 'Files':
      return '📁 Files';
    case 'Knowledge':
      return '📚 Knowledge';
    case 'Cloud':
      return '☁️ Cloud';
    case 'Communication':
      return '💬 Comm';
    default:
      return category;
  }
};

interface ApiKeyConfig {
  [key: string]: {
    label: string;
    placeholder: string;
    description: string;
    required: boolean;
  };
}

const SERVER_API_CONFIGS: Record<string, ApiKeyConfig> = {
  github: {
    GITHUB_PERSONAL_ACCESS_TOKEN: {
      label: 'GitHub Personal Access Token',
      placeholder: 'ghp_xxxxxxxxxxxxxxxxxxxx',
      description: 'Create at github.com/settings/tokens with repo and read:user scopes',
      required: true,
    },
  },
  slack: {
    SLACK_BOT_TOKEN: {
      label: 'Slack Bot Token',
      placeholder: 'xoxb-xxxxxxxxxxxx-xxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxx',
      description: 'Get from your Slack app settings (OAuth & Permissions)',
      required: true,
    },
  },
  gdrive: {
    GOOGLE_CLIENT_ID: {
      label: 'Google Client ID',
      placeholder: 'xxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com',
      description: 'From Google Cloud Console OAuth 2.0 credentials',
      required: true,
    },
    GOOGLE_CLIENT_SECRET: {
      label: 'Google Client Secret',
      placeholder: 'GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      description: 'From Google Cloud Console OAuth 2.0 credentials',
      required: true,
    },
  },
  postgres: {
    DATABASE_URL: {
      label: 'Database URL',
      placeholder: 'postgresql://username:password@hostname:port/database',
      description: 'PostgreSQL connection string',
      required: true,
    },
  },
  'exa-search': {
    EXA_API_KEY: {
      label: 'Exa API Key',
      placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      description: 'Get your API key from exa.ai dashboard',
      required: true,
    },
  },
  'brave-search': {
    BRAVE_API_KEY: {
      label: 'Brave Search API Key',
      placeholder: 'BSxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      description: 'Get your API key from https://api.search.brave.com/app/keys',
      required: true,
    },
  },
  kubernetes: {
    KUBECONFIG: {
      label: 'Kubeconfig Path',
      placeholder: '~/.kube/config',
      description: 'Path to your Kubernetes configuration file',
      required: true,
    },
  },
  elasticsearch: {
    ELASTICSEARCH_URL: {
      label: 'Elasticsearch URL',
      placeholder: 'http://localhost:9200',
      description: 'Elasticsearch cluster URL',
      required: true,
    },
    ELASTICSEARCH_API_KEY: {
      label: 'Elasticsearch API Key',
      placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxx',
      description: 'Elasticsearch API key for authentication',
      required: true,
    },
  },
  weather: {
    OPENWEATHER_API_KEY: {
      label: 'OpenWeatherMap API Key',
      placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      description: 'Get your API key from openweathermap.org',
      required: true,
    },
  },
  sentry: {
    SENTRY_AUTH_TOKEN: {
      label: 'Sentry Auth Token',
      placeholder: 'sntrys_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      description: 'Create at sentry.io/settings/account/api/auth-tokens',
      required: true,
    },
  },
  twitter: {
    TWITTER_BEARER_TOKEN: {
      label: 'Twitter Bearer Token',
      placeholder: 'AAAAAAAAAAAAAAAAAAAAAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      description: 'Get from Twitter Developer Portal (API v2)',
      required: true,
    },
  },
  reddit: {
    REDDIT_CLIENT_ID: {
      label: 'Reddit Client ID',
      placeholder: 'your_client_id_here',
      description: 'From Reddit App Settings',
      required: true,
    },
    REDDIT_CLIENT_SECRET: {
      label: 'Reddit Client Secret',
      placeholder: 'your_client_secret_here',
      description: 'From Reddit App Settings',
      required: true,
    },
  },
  youtube: {
    YOUTUBE_API_KEY: {
      label: 'YouTube API Key',
      placeholder: 'AIzaSyAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      description: 'Get from Google Cloud Console (YouTube Data API v3)',
      required: true,
    },
  },
  openai: {
    OPENAI_API_KEY: {
      label: 'OpenAI API Key',
      placeholder: 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      description: 'Get from OpenAI Platform (platform.openai.com/api-keys)',
      required: true,
    },
  },
  anthropic: {
    ANTHROPIC_API_KEY: {
      label: 'Anthropic API Key',
      placeholder: 'sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      description: 'Get from Anthropic Console (console.anthropic.com/)',
      required: true,
    },
  },
  perplexity: {
    PERPLEXITY_API_KEY: {
      label: 'Perplexity API Key',
      placeholder: 'pplx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      description: 'Get from Perplexity API dashboard',
      required: true,
    },
  },
  replicate: {
    REPLICATE_API_TOKEN: {
      label: 'Replicate API Token',
      placeholder: 'r8_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      description: 'Get from Replicate account settings',
      required: true,
    },
  },
  sonarqube: {
    SONARQUBE_URL: {
      label: 'SonarQube Server URL',
      placeholder: 'http://localhost:9000',
      description: 'URL of your SonarQube server',
      required: true,
    },
    SONARQUBE_TOKEN: {
      label: 'SonarQube Authentication Token',
      placeholder: 'squ_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      description: 'Generate from SonarQube: Administration > Security > Users',
      required: true,
    },
  },
};

interface McpServerWizardProps {
  onAddServer: (serverName: string, config: MCPServerConfig) => void;
}

export default function McpServerWizard({ onAddServer }: McpServerWizardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<'template' | 'custom' | 'configure'>('template');
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [customConfig, setCustomConfig] = useState<any>({
    type: 'stdio',
  });
  const [serverName, setServerName] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [customEnvVars, setCustomEnvVars] = useState<Record<string, string>>({});
  const [newEnvVarKey, setNewEnvVarKey] = useState('');
  const [newEnvVarValue, setNewEnvVarValue] = useState('');
  const [previewedTemplate, setPreviewedTemplate] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredTemplates = useMemo(() => {
    const allTemplates = [...SERVER_TEMPLATES.stdio, ...SERVER_TEMPLATES.http];

    // Filter by category first
    const categoryFiltered =
      selectedCategory === 'All'
        ? allTemplates
        : allTemplates.filter((template) => template.category === selectedCategory);

    // Then filter by search query
    if (!searchQuery.trim()) {
      return categoryFiltered;
    }

    const query = searchQuery.toLowerCase();

    return categoryFiltered.filter(
      (template) =>
        template.name.toLowerCase().includes(query) ||
        template.description.toLowerCase().includes(query) ||
        template.tags.some((tag: string) => tag.toLowerCase().includes(query)) ||
        template.category.toLowerCase().includes(query),
    );
  }, [selectedCategory, searchQuery]);

  useEffect(() => {
    if (step !== 'template') {
      return;
    }

    if (filteredTemplates.length > 0) {
      if (!previewedTemplate || !filteredTemplates.find((t) => t.id === previewedTemplate.id)) {
        setPreviewedTemplate(filteredTemplates[0]);
      }
    } else {
      setPreviewedTemplate(null);
    }
  }, [filteredTemplates, previewedTemplate, step]);

  const handleTemplateSelect = (template: any) => {
    setSelectedTemplate(template);
    setServerName(template.id);
    setStep('configure');
  };

  const handleCustomConfigure = () => {
    setSelectedTemplate(null);
    setServerName('');
    setCustomConfig({ type: 'stdio' });
    setStep('custom');
  };

  const getCurrentStepNumber = () => {
    switch (step) {
      case 'template':
        return 1;
      case 'custom':
        return 1;
      case 'configure':
        return selectedTemplate ? 2 : 3;
      default:
        return 1;
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      const baseConfig = selectedTemplate ? selectedTemplate.config : (customConfig as MCPServerConfig);

      // Add API keys and custom environment variables
      let finalConfig = { ...baseConfig };

      // For custom servers, always use the custom environment variables
      if (!selectedTemplate && Object.keys(customEnvVars).length > 0) {
        if (baseConfig.type === 'stdio') {
          finalConfig = {
            ...baseConfig,
            env: {
              ...baseConfig.env,
              ...customEnvVars,
            },
          };
        } else if (baseConfig.type === 'streamable-http') {
          // For HTTP servers, add custom env vars as headers if they look like headers
          const authHeaders: Record<string, string> = {};

          Object.entries(customEnvVars).forEach(([key, value]) => {
            if (key.toLowerCase().includes('authorization') || key.toLowerCase().includes('api')) {
              if (key.toLowerCase().includes('bearer')) {
                authHeaders.Authorization = `Bearer ${value}`;
              } else {
                authHeaders[key] = value;
              }
            }
          });

          if (Object.keys(authHeaders).length > 0) {
            finalConfig = {
              ...baseConfig,
              headers: {
                ...baseConfig.headers,
                ...authHeaders,
              },
            };
          }
        }
      }

      // For template servers with authentication
      if (selectedTemplate && selectedTemplate.requiresAuth && Object.keys(apiKeys).length > 0) {
        if (baseConfig.type === 'stdio') {
          finalConfig = {
            ...baseConfig,
            env: {
              ...baseConfig.env,
              ...apiKeys,
            },
          };
        } else if (baseConfig.type === 'streamable-http') {
          // For HTTP servers, add API keys as headers
          const authHeaders: Record<string, string> = {};

          if (apiKeys.EXA_API_KEY) {
            authHeaders.Authorization = `Bearer ${apiKeys.EXA_API_KEY}`;
          }

          finalConfig = {
            ...baseConfig,
            headers: {
              ...baseConfig.headers,
              ...authHeaders,
            },
          };
        }
      }

      onAddServer(serverName, finalConfig);
      setIsOpen(false);
      resetWizard();
    } catch (error) {
      console.error('Error adding MCP server:', error);

      // You could add error state here
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetWizard = () => {
    setStep('template');
    setSelectedTemplate(null);
    setCustomConfig({ type: 'stdio' });
    setServerName('');
    setApiKeys({});
    setCustomEnvVars({});
    setNewEnvVarKey('');
    setNewEnvVarValue('');
    setSearchQuery('');
    setIsSubmitting(false);
  };

  const isConfigValid = () => {
    if (!serverName.trim()) {
      return false;
    }

    // Check if required API keys are provided
    if (selectedTemplate && selectedTemplate.requiresAuth) {
      const requiredKeys = SERVER_API_CONFIGS[selectedTemplate.id];

      if (requiredKeys) {
        const missingKeys = Object.entries(requiredKeys)
          .filter(([key, config]) => config.required && !apiKeys[key])
          .map(([key]) => key);

        if (missingKeys.length > 0) {
          return false;
        }
      }
    }

    if (selectedTemplate) {
      return true;
    }

    if (customConfig.type === 'stdio') {
      return !!customConfig.command;
    } else {
      return !!customConfig.url;
    }
  };

  const handleApiKeyChange = (key: string, value: string) => {
    setApiKeys((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleAddEnvVar = () => {
    if (newEnvVarKey.trim() && newEnvVarValue.trim()) {
      setCustomEnvVars((prev) => ({
        ...prev,
        [newEnvVarKey.trim()]: newEnvVarValue.trim(),
      }));
      setNewEnvVarKey('');
      setNewEnvVarValue('');
    }
  };

  const handleRemoveEnvVar = (key: string) => {
    setCustomEnvVars((prev) => {
      const newVars = { ...prev };
      delete newVars[key];

      return newVars;
    });
  };

  const handleEnvVarChange = (key: string, value: string) => {
    setCustomEnvVars((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  return (
    <RadixDialog.Root open={isOpen} onOpenChange={setIsOpen}>
      <RadixDialog.Trigger asChild>
        <Button className="flex items-center gap-2 bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent hover:bg-bolt-elements-button-primary-backgroundHover">
          <Plus className="w-4 h-4" />
          Add MCP Server
        </Button>
      </RadixDialog.Trigger>
      <Dialog className="max-w-screen-xl w-full max-h-[90vh]" aria-labelledby="mcp-wizard-title">
        <div className="p-8 flex flex-col max-h-[85vh]">
          <DialogTitle id="mcp-wizard-title" className="flex items-center gap-2 mb-6 flex-shrink-0">
            <Server className="w-5 h-5" aria-hidden="true" />
            Add MCP Server
          </DialogTitle>

          <ProgressIndicator currentStep={getCurrentStepNumber()} />

          {step === 'template' && (
            <div className="flex flex-col lg:flex-row flex-1 min-h-0 animate-in fade-in-0 duration-300">
              <div className="w-full lg:w-1/3 xl:w-1/4 border-b lg:border-b-0 lg:border-r border-bolt-elements-borderColor pb-6 lg:pb-0 lg:pr-6 flex flex-col max-h-full">
                <div className="mb-4 flex-shrink-0">
                  <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Search servers..." />
                </div>
                <p className="text-sm text-bolt-elements-textSecondary mb-3 px-2 flex-shrink-0">Categories</p>
                <div className="flex flex-wrap gap-2 justify-start lg:justify-center mb-4 flex-shrink-0">
                  {CATEGORIES.map((category) => (
                    <Badge
                      key={category}
                      variant={selectedCategory === category ? 'default' : 'secondary'}
                      className="cursor-pointer hover:scale-105 transition-transform"
                      onClick={() => setSelectedCategory(category)}
                    >
                      {getCategoryIcon(category)}
                    </Badge>
                  ))}
                </div>
                <div className="flex-1 overflow-y-auto pr-2" role="list" aria-label="Available MCP server templates">
                  <div className="space-y-2">
                    {filteredTemplates.map((template) => (
                      <div
                        key={template.id}
                        onClick={() => setPreviewedTemplate(template)}
                        onDoubleClick={() => handleTemplateSelect(template)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setPreviewedTemplate(template);
                          }
                        }}
                        tabIndex={0}
                        role="listitem"
                        aria-label={`Select ${template.name} server template`}
                        aria-selected={previewedTemplate?.id === template.id}
                        className={`p-4 rounded-xl cursor-pointer transition-all duration-200 border focus:outline-none focus:ring-2 focus:ring-bolt-elements-item-backgroundAccent focus:ring-offset-2 focus:ring-offset-bolt-elements-background-depth-1 ${
                          previewedTemplate?.id === template.id
                            ? 'bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent border-bolt-elements-item-backgroundAccent shadow-md'
                            : 'hover:bg-bolt-elements-background-depth-1 border-bolt-elements-borderColor hover:border-bolt-elements-item-backgroundAccent/50'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`p-2 rounded-lg transition-colors flex-shrink-0 ${
                              previewedTemplate?.id === template.id
                                ? 'bg-white/10'
                                : 'bg-bolt-elements-background-depth-2'
                            }`}
                          >
                            {template.icon}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-sm truncate">{template.name}</p>
                            <p className="text-xs opacity-70 mb-2">{template.category}</p>
                            <div className="flex flex-wrap gap-1">
                              {template.tags.slice(0, 2).map((tag: string) => (
                                <Badge key={tag} variant="outline" className="text-xs px-1 py-0">
                                  {tag}
                                </Badge>
                              ))}
                              {template.tags.length > 2 && (
                                <Badge variant="outline" className="text-xs px-1 py-0">
                                  +{template.tags.length - 2}
                                </Badge>
                              )}
                            </div>
                          </div>
                          {template.requiresAuth && (
                            <div className="flex-shrink-0">
                              <Badge variant="secondary" className="text-xs">
                                🔐 Auth
                              </Badge>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  {filteredTemplates.length === 0 && (
                    <div className="text-center py-8">
                      <Search className="w-12 h-12 text-bolt-elements-textSecondary mx-auto mb-4" />
                      <p className="text-sm text-bolt-elements-textSecondary">
                        {searchQuery ? 'No servers match your search' : 'No servers in this category'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
              <div className="w-full lg:w-2/3 xl:w-3/4 lg:pl-6 flex flex-col flex-1 min-h-0">
                {previewedTemplate ? (
                  <>
                    <div className="flex-1 space-y-6 overflow-y-auto pr-6">
                      <div className="bg-gradient-to-r from-bolt-elements-background-depth-2 to-bolt-elements-background-depth-1 p-6 rounded-xl border border-bolt-elements-borderColor">
                        <div className="flex items-start gap-4">
                          <div className="p-3 rounded-xl bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor">
                            {previewedTemplate.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between mb-2">
                              <h3 className="text-xl font-bold text-bolt-elements-textPrimary">
                                {previewedTemplate.name}
                              </h3>
                              <div className="flex gap-2 flex-shrink-0">
                                {previewedTemplate.status === 'verified' && (
                                  <Badge
                                    variant="default"
                                    className="bg-green-500/10 text-green-400 border-green-500/20"
                                  >
                                    ✓ Verified
                                  </Badge>
                                )}
                                {previewedTemplate.requiresAuth && <Badge variant="secondary">🔐 Requires Auth</Badge>}
                              </div>
                            </div>
                            <p className="text-bolt-elements-textSecondary text-sm leading-relaxed mb-4">
                              {previewedTemplate.description}
                            </p>
                            <div className="flex items-center gap-4 text-xs text-bolt-elements-textSecondary">
                              <span className="flex items-center gap-1">
                                <Terminal className="w-3 h-3" />
                                {previewedTemplate.category}
                              </span>
                              <span className="flex items-center gap-1">
                                <Server className="w-3 h-3" />
                                {previewedTemplate.config.type}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {previewedTemplate.authNote && (
                        <div className="p-3 rounded-md bg-yellow-900/30 border border-yellow-700/50">
                          <p className="text-sm text-yellow-300 flex items-start gap-2">
                            <span className="i-ph-warning-duotone text-base mt-0.5 flex-shrink-0" />
                            <span>
                              <strong className="font-semibold">Authentication Required:</strong>{' '}
                              {previewedTemplate.authNote}
                            </span>
                          </p>
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h4 className="font-semibold mb-3 text-bolt-elements-textSecondary flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              Tags
                            </Badge>
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {previewedTemplate.tags.map((tag: string) => (
                              <Badge key={tag} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </div>

                        <div>
                          <h4 className="font-semibold mb-3 text-bolt-elements-textSecondary flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              Server Type
                            </Badge>
                          </h4>
                          <div className="flex items-center gap-2">
                            <Badge variant="default" className="bg-blue-500/10 text-blue-400 border-blue-500/20">
                              {previewedTemplate.config.type === 'stdio'
                                ? 'STDIO'
                                : previewedTemplate.config.type === 'streamable-http'
                                  ? 'HTTP'
                                  : 'SSE'}
                            </Badge>
                            {previewedTemplate.config.type === 'stdio' && (
                              <span className="text-xs text-bolt-elements-textSecondary">Local process execution</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-semibold mb-3 text-bolt-elements-textSecondary flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            Configuration Preview
                          </Badge>
                        </h4>
                        <div className="bg-bolt-elements-background-depth-1 p-4 rounded-lg border border-bolt-elements-borderColor">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                            <div>
                              <span className="font-medium text-bolt-elements-textSecondary">Type:</span>
                              <span className="ml-2 text-bolt-elements-textPrimary">
                                {previewedTemplate.config.type}
                              </span>
                            </div>
                            {previewedTemplate.config.command && (
                              <div>
                                <span className="font-medium text-bolt-elements-textSecondary">Command:</span>
                                <code className="ml-2 text-bolt-elements-textPrimary bg-bolt-elements-background-depth-2 px-1 py-0.5 rounded">
                                  {previewedTemplate.config.command}
                                </code>
                              </div>
                            )}
                            {previewedTemplate.config.url && (
                              <div className="col-span-2">
                                <span className="font-medium text-bolt-elements-textSecondary">URL:</span>
                                <code className="ml-2 text-bolt-elements-textPrimary bg-bolt-elements-background-depth-2 px-1 py-0.5 rounded break-all">
                                  {previewedTemplate.config.url}
                                </code>
                              </div>
                            )}
                            {previewedTemplate.config.args && previewedTemplate.config.args.length > 0 && (
                              <div className="col-span-2">
                                <span className="font-medium text-bolt-elements-textSecondary">Arguments:</span>
                                <div className="ml-2 mt-1 flex flex-wrap gap-1">
                                  {previewedTemplate.config.args.map((arg: string, index: number) => (
                                    <code
                                      key={index}
                                      className="text-bolt-elements-textPrimary bg-bolt-elements-background-depth-2 px-1 py-0.5 rounded text-xs"
                                    >
                                      {arg}
                                    </code>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-bolt-elements-borderColor flex-shrink-0 pb-4">
                      <Button variant="outline" onClick={handleCustomConfigure}>
                        <Terminal className="w-4 h-4 mr-2" />
                        Create Custom Server
                      </Button>
                      <Button
                        className="bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent hover:bg-bolt-elements-button-primary-backgroundHover"
                        onClick={() => handleTemplateSelect(previewedTemplate)}
                      >
                        Configure Template
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center p-8">
                    <div className="bg-bolt-elements-background-depth-2 p-6 rounded-full mb-6">
                      <Search className="w-12 h-12 text-bolt-elements-textSecondary" />
                    </div>
                    <h4 className="text-xl font-semibold text-bolt-elements-textPrimary mb-3">
                      {searchQuery ? 'No servers match your search' : 'No templates found'}
                    </h4>
                    <p className="text-sm text-bolt-elements-textSecondary mb-6 max-w-md">
                      {searchQuery
                        ? `Try adjusting your search terms or browse all categories.`
                        : 'Try selecting a different category or create a custom configuration.'}
                    </p>
                    <div className="flex gap-3">
                      {searchQuery && (
                        <Button variant="outline" onClick={() => setSearchQuery('')}>
                          <X className="w-4 h-4 mr-2" />
                          Clear Search
                        </Button>
                      )}
                      <Button variant="outline" onClick={handleCustomConfigure}>
                        <Terminal className="w-4 h-4 mr-2" />
                        Create Custom Server
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 'custom' && (
            <div className="flex-1 space-y-4 overflow-y-auto animate-in fade-in-0 slide-in-from-right-4 duration-300">
              <div className="text-center mb-6">
                <h3 className="text-lg font-medium">Custom MCP Server Configuration</h3>
                <p className="text-bolt-elements-textSecondary text-sm">Configure your own MCP server connection</p>
              </div>

              <Tabs
                value={customConfig.type}
                onValueChange={(value) => setCustomConfig({ ...customConfig, type: value as any })}
              >
                <TabsList className="grid grid-cols-3 w-full">
                  <TabsTrigger value="stdio" className="flex items-center gap-2">
                    <Terminal className="w-4 h-4" />
                    STDIO
                  </TabsTrigger>
                  <TabsTrigger value="sse" className="flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    SSE
                  </TabsTrigger>
                  <TabsTrigger value="streamable-http" className="flex items-center gap-2">
                    <Globe className="w-4 h-4" />
                    HTTP
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="stdio" className="space-y-4">
                  <div>
                    <Label htmlFor="command">Command</Label>
                    <Input
                      id="command"
                      placeholder="e.g., npx, node, python"
                      value={customConfig.command || ''}
                      onChange={(e) => setCustomConfig({ ...customConfig, command: e.target.value })}
                      className={!customConfig.command ? 'border-red-500/50 focus:border-red-500' : ''}
                      aria-invalid={!customConfig.command}
                      aria-describedby={!customConfig.command ? 'command-error' : undefined}
                    />
                    {!customConfig.command && (
                      <p id="command-error" className="text-sm text-red-400 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Command is required for STDIO servers
                      </p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="args">Arguments (one per line)</Label>
                    <Textarea
                      id="args"
                      className="min-h-[80px]"
                      placeholder="-y&#10;@modelcontextprotocol/server-example"
                      value={customConfig.args?.join('\n') || ''}
                      onChange={(e) =>
                        setCustomConfig({
                          ...customConfig,
                          args: e.target.value.split('\n').filter(Boolean),
                        })
                      }
                    />
                  </div>

                  {/* Environment Variables Section */}
                  <div className="space-y-3">
                    <Label>Environment Variables</Label>

                    {/* Add new environment variable */}
                    <div className="flex gap-2">
                      <Input
                        placeholder="Variable name (e.g., API_KEY)"
                        value={newEnvVarKey}
                        onChange={(e) => setNewEnvVarKey(e.target.value)}
                        className="flex-1"
                      />
                      <Input
                        placeholder="Value"
                        type="password"
                        value={newEnvVarValue}
                        onChange={(e) => setNewEnvVarValue(e.target.value)}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        onClick={handleAddEnvVar}
                        disabled={!newEnvVarKey.trim() || !newEnvVarValue.trim()}
                        size="sm"
                        className="px-3"
                      >
                        Add
                      </Button>
                    </div>

                    {/* Display existing environment variables */}
                    {Object.keys(customEnvVars).length > 0 && (
                      <div className="space-y-2 max-h-32 overflow-y-auto">
                        {Object.entries(customEnvVars).map(([key, value]) => (
                          <div
                            key={key}
                            className="flex items-center gap-2 p-2 bg-bolt-elements-background-depth-2 rounded"
                          >
                            <code className="flex-1 text-xs font-mono">{key}</code>
                            <Input
                              type="password"
                              value={value}
                              onChange={(e) => handleEnvVarChange(key, e.target.value)}
                              className="flex-1 text-xs"
                            />
                            <Button
                              type="button"
                              onClick={() => handleRemoveEnvVar(key)}
                              size="sm"
                              variant="outline"
                              className="px-2"
                            >
                              <span className="i-ph:trash text-xs" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}

                    {Object.keys(customEnvVars).length === 0 && (
                      <p className="text-xs text-bolt-elements-textSecondary">
                        No environment variables added. Add API keys, tokens, or other configuration here.
                      </p>
                    )}

                    {Object.keys(customEnvVars).length > 0 && (
                      <div className="mt-3 p-2 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
                        <p className="text-xs text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
                          <span>⚠️</span>
                          <span>
                            <strong>Security:</strong> Environment variables containing sensitive data may be visible in
                            system process lists. Consider using secure credential storage for production use.
                          </span>
                        </p>
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="sse" className="space-y-4">
                  <div>
                    <Label htmlFor="url">Server URL</Label>
                    <Input
                      id="url"
                      placeholder="http://localhost:8000/sse"
                      value={customConfig.url || ''}
                      onChange={(e) => setCustomConfig({ ...customConfig, url: e.target.value })}
                    />
                  </div>

                  {/* Headers Section for SSE */}
                  <div className="space-y-3">
                    <Label>Headers (Optional)</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Header name (e.g., Authorization)"
                        value={newEnvVarKey}
                        onChange={(e) => setNewEnvVarKey(e.target.value)}
                        className="flex-1"
                      />
                      <Input
                        placeholder="Header value"
                        type="password"
                        value={newEnvVarValue}
                        onChange={(e) => setNewEnvVarValue(e.target.value)}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        onClick={handleAddEnvVar}
                        disabled={!newEnvVarKey.trim() || !newEnvVarValue.trim()}
                        size="sm"
                        className="px-3"
                      >
                        Add
                      </Button>
                    </div>

                    {Object.keys(customEnvVars).length > 0 && (
                      <>
                        <div className="space-y-2 max-h-32 overflow-y-auto">
                          {Object.entries(customEnvVars).map(([key, value]) => (
                            <div
                              key={key}
                              className="flex items-center gap-2 p-2 bg-bolt-elements-background-depth-2 rounded"
                            >
                              <code className="flex-1 text-xs font-mono">{key}</code>
                              <Input
                                type="password"
                                value={value}
                                onChange={(e) => handleEnvVarChange(key, e.target.value)}
                                className="flex-1 text-xs"
                              />
                              <Button
                                type="button"
                                onClick={() => handleRemoveEnvVar(key)}
                                size="sm"
                                variant="outline"
                                className="px-2"
                              >
                                <span className="i-ph:trash text-xs" />
                              </Button>
                            </div>
                          ))}
                        </div>
                        <div className="mt-3 p-2 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
                          <p className="text-xs text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
                            <span>⚠️</span>
                            <span>
                              <strong>Security:</strong> Headers containing sensitive data may be visible in logs.
                              Consider using secure credential storage for production use.
                            </span>
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="streamable-http" className="space-y-4">
                  <div>
                    <Label htmlFor="http-url">Server URL</Label>
                    <Input
                      id="http-url"
                      placeholder="https://api.example.com/mcp"
                      value={customConfig.url || ''}
                      onChange={(e) => setCustomConfig({ ...customConfig, url: e.target.value })}
                      className={!customConfig.url ? 'border-red-500/50 focus:border-red-500' : ''}
                      aria-invalid={!customConfig.url}
                      aria-describedby={!customConfig.url ? 'url-error' : undefined}
                    />
                    {!customConfig.url && (
                      <p id="url-error" className="text-sm text-red-400 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        URL is required for HTTP servers
                      </p>
                    )}
                  </div>

                  {/* Headers Section for HTTP */}
                  <div className="space-y-3">
                    <Label>Headers (Optional)</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Header name (e.g., Authorization)"
                        value={newEnvVarKey}
                        onChange={(e) => setNewEnvVarKey(e.target.value)}
                        className="flex-1"
                      />
                      <Input
                        placeholder="Header value"
                        type="password"
                        value={newEnvVarValue}
                        onChange={(e) => setNewEnvVarValue(e.target.value)}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        onClick={handleAddEnvVar}
                        disabled={!newEnvVarKey.trim() || !newEnvVarValue.trim()}
                        size="sm"
                        className="px-3"
                      >
                        Add
                      </Button>
                    </div>

                    {Object.keys(customEnvVars).length > 0 && (
                      <>
                        <div className="space-y-2 max-h-32 overflow-y-auto">
                          {Object.entries(customEnvVars).map(([key, value]) => (
                            <div
                              key={key}
                              className="flex items-center gap-2 p-2 bg-bolt-elements-background-depth-2 rounded"
                            >
                              <code className="flex-1 text-xs font-mono">{key}</code>
                              <Input
                                type="password"
                                value={value}
                                onChange={(e) => handleEnvVarChange(key, e.target.value)}
                                className="flex-1 text-xs"
                              />
                              <Button
                                type="button"
                                onClick={() => handleRemoveEnvVar(key)}
                                size="sm"
                                variant="outline"
                                className="px-2"
                              >
                                <span className="i-ph:trash text-xs" />
                              </Button>
                            </div>
                          ))}
                        </div>
                        <div className="mt-3 p-2 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
                          <p className="text-xs text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
                            <span>⚠️</span>
                            <span>
                              <strong>Security:</strong> Headers containing sensitive data may be visible in logs.
                              Consider using secure credential storage for production use.
                            </span>
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}

          {step === 'configure' && (
            <div className="flex-1 space-y-6 overflow-y-auto animate-in fade-in-0 slide-in-from-right-4 duration-300">
              <div className="text-center">
                <h3 className="text-lg font-medium">
                  {selectedTemplate ? `Configure ${selectedTemplate.name}` : 'Configure Custom Server'}
                </h3>
                <p className="text-bolt-elements-textSecondary text-sm">Finalize your server configuration</p>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="server-name">Server Name</Label>
                  <Input
                    id="server-name"
                    placeholder="Enter a unique server name"
                    value={serverName}
                    onChange={(e) => setServerName(e.target.value)}
                    className={!serverName.trim() ? 'border-red-500/50 focus:border-red-500' : ''}
                    aria-invalid={!serverName.trim()}
                    aria-describedby={!serverName.trim() ? 'server-name-error' : undefined}
                  />
                  {!serverName.trim() && (
                    <p id="server-name-error" className="text-sm text-red-400 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Server name is required
                    </p>
                  )}
                </div>

                {selectedTemplate && selectedTemplate.requiresAuth && SERVER_API_CONFIGS[selectedTemplate.id] && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm flex items-center gap-2">🔑 API Configuration Required</CardTitle>
                      <CardDescription className="text-xs">
                        This server requires API keys or credentials to function properly
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {Object.entries(SERVER_API_CONFIGS[selectedTemplate.id]).map(([key, config]) => (
                        <div key={key}>
                          <Label htmlFor={key} className="flex items-center gap-2">
                            {config.label}
                            {config.required && <span className="text-red-500">*</span>}
                          </Label>
                          <Input
                            id={key}
                            type="password"
                            placeholder={config.placeholder}
                            value={apiKeys[key] || ''}
                            onChange={(e) => handleApiKeyChange(key, e.target.value)}
                            className="font-mono text-xs"
                          />
                          <p className="text-xs text-bolt-elements-textSecondary mt-1">{config.description}</p>
                        </div>
                      ))}

                      <div className="mt-4 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
                        <h4 className="text-xs font-medium text-yellow-700 dark:text-yellow-400 mb-1 flex items-center gap-1">
                          <span className="text-base">⚠️</span>
                          Security Warning
                        </h4>
                        <p className="text-xs text-yellow-600 dark:text-yellow-400">
                          <strong>Important:</strong> API keys are passed to MCP servers via environment variables.
                          While they are stored securely and not logged, they may be visible in system process lists.
                          Use caution with sensitive credentials.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {selectedTemplate && (
                  <Card>
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        {selectedTemplate.icon}
                        <div>
                          <CardTitle className="text-sm">{selectedTemplate.name}</CardTitle>
                          <CardDescription className="text-xs">{selectedTemplate.description}</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="bg-bolt-elements-background-depth-1 p-3 rounded-lg">
                        <pre className="text-xs text-bolt-elements-textSecondary">
                          {JSON.stringify(sanitizeConfigForDisplay(selectedTemplate.config), null, 2)}
                        </pre>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-bolt-elements-borderColor flex-shrink-0 pb-4">
                <Button variant="outline" onClick={() => setStep('template')} disabled={isSubmitting}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <Button
                  className="bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent hover:bg-bolt-elements-button-primary-backgroundHover"
                  onClick={handleSubmit}
                  disabled={!isConfigValid() || isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Adding Server...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Add Server
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {step === 'custom' && (
            <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-bolt-elements-borderColor flex-shrink-0 pb-4">
              <Button variant="outline" onClick={() => setStep('template')} disabled={isSubmitting}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button
                className="bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent hover:bg-bolt-elements-button-primary-backgroundHover"
                onClick={() => setStep('configure')}
                disabled={!customConfig.command && !customConfig.url}
              >
                Continue
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          )}
        </div>
      </Dialog>
    </RadixDialog.Root>
  );
}
