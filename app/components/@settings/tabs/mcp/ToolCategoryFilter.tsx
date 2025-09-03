import { useMemo } from 'react';
import { Badge } from '~/components/ui/Badge';
import { Input } from '~/components/ui/Input';
import { classNames } from '~/utils/classNames';
import {
  Search,
  FileText,
  Globe,
  Code2,
  Database,
  Cloud,
  Shield,
  Cpu,
  MessageSquare,
  Settings,
  Filter,
} from 'lucide-react';
import type { Tool } from 'ai';

// Tool categories based on common patterns
const TOOL_CATEGORIES = {
  files: {
    name: 'Files',
    icon: <FileText className="w-3 h-3" />,
    keywords: ['file', 'directory', 'read', 'write', 'upload', 'download', 'filesystem'],
    color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20',
  },
  web: {
    name: 'Web',
    icon: <Globe className="w-3 h-3" />,
    keywords: ['http', 'url', 'web', 'api', 'fetch', 'request', 'browser', 'scrape'],
    color: 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20',
  },
  code: {
    name: 'Code',
    icon: <Code2 className="w-3 h-3" />,
    keywords: ['code', 'execute', 'run', 'compile', 'build', 'lint', 'format', 'git'],
    color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20',
  },
  data: {
    name: 'Data',
    icon: <Database className="w-3 h-3" />,
    keywords: ['database', 'query', 'sql', 'json', 'csv', 'parse', 'transform', 'analyze'],
    color: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20',
  },
  cloud: {
    name: 'Cloud',
    icon: <Cloud className="w-3 h-3" />,
    keywords: ['aws', 'azure', 'gcp', 'docker', 'kubernetes', 'deploy', 'container'],
    color: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20',
  },
  security: {
    name: 'Security',
    icon: <Shield className="w-3 h-3" />,
    keywords: ['auth', 'security', 'encrypt', 'decrypt', 'token', 'key', 'certificate'],
    color: 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20',
  },
  system: {
    name: 'System',
    icon: <Cpu className="w-3 h-3" />,
    keywords: ['system', 'process', 'memory', 'cpu', 'disk', 'monitor', 'status'],
    color:
      'bg-bolt-elements-background-depth-3 text-bolt-elements-textSecondary border border-bolt-elements-borderColor',
  },
  communication: {
    name: 'Communication',
    icon: <MessageSquare className="w-3 h-3" />,
    keywords: ['email', 'slack', 'discord', 'webhook', 'notify', 'message', 'send'],
    color: 'bg-pink-500/10 text-pink-600 dark:text-pink-400 border border-pink-500/20',
  },
};

interface ToolInfo {
  serverName: string;
  toolName: string;
  tool: Tool;
  category: string;
}

interface ToolCategoryFilterProps {
  serverTools: Record<string, any>;
  selectedCategory: string;
  searchTerm: string;
  onCategoryChange: (category: string) => void;
  onSearchChange: (search: string) => void;
  children: (filteredTools: ToolInfo[]) => React.ReactNode;
}

export default function ToolCategoryFilter({
  serverTools,
  selectedCategory,
  searchTerm,
  onCategoryChange,
  onSearchChange,
  children,
}: ToolCategoryFilterProps) {
  const allTools = useMemo(() => {
    const tools: ToolInfo[] = [];

    Object.entries(serverTools).forEach(([serverName, serverInfo]) => {
      if (serverInfo.status === 'available') {
        Object.entries(serverInfo.tools).forEach(([toolName, tool]) => {
          const category = categorizeTools(toolName, tool as Tool);
          tools.push({
            serverName,
            toolName,
            tool: tool as Tool,
            category,
          });
        });
      }
    });

    return tools;
  }, [serverTools]);

  const filteredTools = useMemo(() => {
    let filtered = allTools;

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter((tool) => tool.category === selectedCategory);
    }

    // Filter by search term
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (tool) =>
          tool.toolName.toLowerCase().includes(searchLower) ||
          tool.tool.description?.toLowerCase().includes(searchLower) ||
          tool.serverName.toLowerCase().includes(searchLower),
      );
    }

    return filtered;
  }, [allTools, selectedCategory, searchTerm]);

  const categoryStats = useMemo(() => {
    const stats: Record<string, number> = { all: allTools.length };

    (Object.keys(TOOL_CATEGORIES) as Array<keyof typeof TOOL_CATEGORIES>).forEach((category) => {
      stats[category] = allTools.filter((tool) => tool.category === category).length;
    });

    stats.other = allTools.filter((tool) => tool.category === 'other').length;

    return stats;
  }, [allTools]);

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-bolt-elements-textTertiary" />
        <Input
          placeholder="Search tools..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Category Filters */}
      <div className="flex flex-wrap gap-2">
        <Badge
          variant={selectedCategory === 'all' ? 'default' : 'secondary'}
          className={classNames(
            'cursor-pointer transition-colors',
            selectedCategory === 'all'
              ? 'bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent'
              : 'hover:bg-bolt-elements-background-depth-2',
          )}
          onClick={() => onCategoryChange('all')}
        >
          <Filter className="w-3 h-3 mr-1" />
          All ({categoryStats.all})
        </Badge>

        {Object.entries(TOOL_CATEGORIES).map(([key, category]) => (
          <Badge
            key={key}
            variant={selectedCategory === key ? 'default' : 'secondary'}
            className={classNames(
              'cursor-pointer transition-colors flex items-center gap-1',
              selectedCategory === key ? category.color : 'hover:bg-bolt-elements-background-depth-2',
            )}
            onClick={() => onCategoryChange(key)}
          >
            {category.icon}
            {category.name} ({categoryStats[key] || 0})
          </Badge>
        ))}

        {categoryStats.other > 0 && (
          <Badge
            variant={selectedCategory === 'other' ? 'default' : 'secondary'}
            className={classNames(
              'cursor-pointer transition-colors',
              selectedCategory === 'other'
                ? 'bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent'
                : 'hover:bg-bolt-elements-background-depth-2',
            )}
            onClick={() => onCategoryChange('other')}
          >
            <Settings className="w-3 h-3 mr-1" />
            Other ({categoryStats.other})
          </Badge>
        )}
      </div>

      {/* Results Summary */}
      <div className="flex items-center justify-between text-sm text-bolt-elements-textSecondary">
        <span>
          {filteredTools.length} tool{filteredTools.length !== 1 ? 's' : ''}
          {searchTerm && ` matching "${searchTerm}"`}
          {selectedCategory !== 'all' &&
            ` in ${TOOL_CATEGORIES[selectedCategory as keyof typeof TOOL_CATEGORIES]?.name || selectedCategory}`}
        </span>
        {(searchTerm || selectedCategory !== 'all') && (
          <button
            onClick={() => {
              onSearchChange('');
              onCategoryChange('all');
            }}
            className="text-bolt-elements-textPrimary hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Render filtered tools */}
      {children(filteredTools)}
    </div>
  );
}

function categorizeTools(toolName: string, tool: Tool): string {
  const searchText = `${toolName} ${tool.description || ''}`.toLowerCase();

  // Check for exact matches first
  const exactMatches = {
    files: ['read_file', 'write_file', 'list_directory', 'create_directory', 'delete_file'],
    web: ['fetch', 'get_url', 'web_search', 'http_request', 'scrape'],
    code: ['execute_code', 'run_command', 'git_clone', 'build_project'],
    data: ['query_database', 'parse_json', 'transform_data', 'analyze'],
  };

  for (const [category, exactTools] of Object.entries(exactMatches)) {
    if (exactTools.some((exact) => toolName.toLowerCase().includes(exact))) {
      return category;
    }
  }

  // Fall back to keyword matching
  for (const [category, config] of Object.entries(TOOL_CATEGORIES)) {
    if (config.keywords.some((keyword) => searchText.includes(keyword))) {
      return category;
    }
  }

  return 'other';
}
