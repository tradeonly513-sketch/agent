import { useState } from 'react';
import ToolCategoryFilter from './ToolCategoryFilter';
import McpServerListItem from './McpServerListItem';
import { Badge } from '~/components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/Card';
import { Button } from '~/components/ui/Button';
import { ChevronDown, ChevronUp, Server, Wrench as ToolIcon, Copy } from 'lucide-react';
import type { Tool } from 'ai';

interface ToolInfo {
  serverName: string;
  toolName: string;
  tool: Tool;
  category: string;
}

interface ToolBrowserProps {
  serverTools: Record<string, any>;
}

export default function ToolBrowser({ serverTools }: ToolBrowserProps) {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedTool, setExpandedTool] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');

  const toggleToolExpanded = (toolKey: string) => {
    setExpandedTool(expandedTool === toolKey ? null : toolKey);
  };

  const copyToolName = async (toolName: string) => {
    try {
      await navigator.clipboard.writeText(toolName);
    } catch {
      // Fallback for browsers that don't support clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = toolName;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
  };

  const renderToolCard = (toolInfo: ToolInfo) => {
    const toolKey = `${toolInfo.serverName}-${toolInfo.toolName}`;
    const isExpanded = expandedTool === toolKey;

    return (
      <Card key={toolKey} className="hover:border-bolt-elements-borderColorActive transition-colors">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <ToolIcon className="w-5 h-5 text-bolt-elements-textPrimary flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <CardTitle className="text-sm font-medium truncate">{toolInfo.toolName}</CardTitle>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" size="sm" className="text-xs">
                    <Server className="w-2 h-2 mr-1" />
                    {toolInfo.serverName}
                  </Badge>
                  <Badge variant="secondary" size="sm" className="text-xs capitalize">
                    {toolInfo.category}
                  </Badge>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToolName(toolInfo.toolName)}
                className="h-6 w-6 p-0 !bg-transparent border border-bolt-elements-borderColor hover:!bg-bolt-elements-background-depth-2 text-bolt-elements-textTertiary"
                title="Copy tool name"
              >
                <Copy className="w-3 h-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleToolExpanded(toolKey)}
                className="h-6 w-6 p-0 !bg-transparent border border-bolt-elements-borderColor hover:!bg-bolt-elements-background-depth-2 text-bolt-elements-textTertiary"
              >
                {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </Button>
            </div>
          </div>
        </CardHeader>

        {toolInfo.tool.description && (
          <CardContent className="pt-0 pb-2">
            <p className="text-sm text-bolt-elements-textSecondary">{toolInfo.tool.description}</p>
          </CardContent>
        )}

        {isExpanded && (
          <CardContent className="pt-0 border-t border-bolt-elements-borderColor">
            <McpServerListItem toolName={toolInfo.toolName} toolSchema={toolInfo.tool} />
          </CardContent>
        )}
      </Card>
    );
  };

  const renderToolList = (toolInfo: ToolInfo) => {
    const toolKey = `${toolInfo.serverName}-${toolInfo.toolName}`;
    const isExpanded = expandedTool === toolKey;

    return (
      <div
        key={toolKey}
        className="border border-bolt-elements-borderColor rounded-lg hover:border-bolt-elements-borderColorActive transition-colors"
      >
        <div className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <ToolIcon className="w-5 h-5 text-bolt-elements-textPrimary flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-bolt-elements-textPrimary text-sm truncate">{toolInfo.toolName}</h3>
                  <Badge variant="outline" size="sm" className="text-xs">
                    {toolInfo.serverName}
                  </Badge>
                </div>
                {toolInfo.tool.description && (
                  <p className="text-xs text-bolt-elements-textSecondary mt-1 line-clamp-2">
                    {toolInfo.tool.description}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1 flex-shrink-0">
              <Badge variant="secondary" size="sm" className="capitalize">
                {toolInfo.category}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToolName(toolInfo.toolName)}
                className="h-6 w-6 p-0 !bg-transparent border border-bolt-elements-borderColor hover:!bg-bolt-elements-background-depth-2 text-bolt-elements-textTertiary"
                title="Copy tool name"
              >
                <Copy className="w-3 h-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleToolExpanded(toolKey)}
                className="h-6 w-6 p-0 !bg-transparent border border-bolt-elements-borderColor hover:!bg-bolt-elements-background-depth-2 text-bolt-elements-textTertiary"
              >
                {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </Button>
            </div>
          </div>

          {isExpanded && (
            <div className="mt-3 pt-3 border-t border-bolt-elements-borderColor">
              <McpServerListItem toolName={toolInfo.toolName} toolSchema={toolInfo.tool} />
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-bolt-elements-textPrimary">Tool Browser</h2>
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('list')}
            className={
              viewMode === 'list'
                ? '!bg-bolt-elements-item-backgroundAccent !text-bolt-elements-item-contentAccent hover:!bg-bolt-elements-button-primary-backgroundHover'
                : ''
            }
          >
            List
          </Button>
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('grid')}
            className={
              viewMode === 'grid'
                ? '!bg-bolt-elements-item-backgroundAccent !text-bolt-elements-item-contentAccent hover:!bg-bolt-elements-button-primary-backgroundHover'
                : ''
            }
          >
            Grid
          </Button>
        </div>
      </div>

      <ToolCategoryFilter
        serverTools={serverTools}
        selectedCategory={selectedCategory}
        searchTerm={searchTerm}
        onCategoryChange={setSelectedCategory}
        onSearchChange={setSearchTerm}
      >
        {(filteredTools) => (
          <div className="space-y-3">
            {filteredTools.length === 0 ? (
              <div className="text-center py-8 bg-bolt-elements-background-depth-1 rounded-lg border border-bolt-elements-borderColor">
                <ToolIcon className="w-8 h-8 text-bolt-elements-textTertiary mx-auto mb-3" />
                <h3 className="text-sm font-medium text-bolt-elements-textSecondary">No tools found</h3>
                <p className="text-xs text-bolt-elements-textTertiary mt-1">
                  {searchTerm
                    ? `No tools match "${searchTerm}"`
                    : selectedCategory !== 'all'
                      ? `No tools in the ${selectedCategory} category`
                      : 'No tools are currently available'}
                </p>
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{filteredTools.map(renderToolCard)}</div>
            ) : (
              <div className="space-y-3">{filteredTools.map(renderToolList)}</div>
            )}
          </div>
        )}
      </ToolCategoryFilter>
    </div>
  );
}
