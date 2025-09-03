import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '~/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/Card';
import { Badge } from '~/components/ui/Badge';
import { classNames } from '~/utils/classNames';
import { PromptLibrary } from '~/lib/common/prompt-library';
import type { CustomPrompt } from '~/lib/common/prompt-library';
import { Settings, Trash2, Calendar, AlertCircle } from 'lucide-react';
import { toast } from 'react-toastify';

interface CustomPromptManagerProps {
  className?: string;
}

const TOKEN_USAGE_CONFIG = {
  low: { label: 'Low', color: 'success' },
  medium: { label: 'Balanced', color: 'info' },
  high: { label: 'High', color: 'warning' },
} as const;

const COMPLEXITY_CONFIG = {
  simple: { label: 'Simple', color: 'success' },
  moderate: { label: 'Moderate', color: 'info' },
  advanced: { label: 'Advanced', color: 'primary' },
} as const;

export const CustomPromptManager = ({ className }: CustomPromptManagerProps) => {
  const [customPrompts, setCustomPrompts] = useState<CustomPrompt[]>([]);

  // Load custom prompts
  useEffect(() => {
    const loadPrompts = () => {
      setCustomPrompts(PromptLibrary.getCustomPrompts());
    };

    loadPrompts();

    // Listen for storage changes
    const handleStorageChange = () => {
      loadPrompts();
    };

    window.addEventListener('storage', handleStorageChange);

    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const handleDeletePrompt = (prompt: CustomPrompt) => {
    if (confirm(`Are you sure you want to delete "${prompt.label}"? This action cannot be undone.`)) {
      const success = PromptLibrary.deleteCustomPrompt(prompt.id);

      if (success) {
        setCustomPrompts((prev) => prev.filter((p) => p.id !== prompt.id));
        toast.success('Custom prompt deleted successfully!');
      } else {
        toast.error('Failed to delete custom prompt');
      }
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (customPrompts.length === 0) {
    return (
      <motion.div
        className={classNames('flex flex-col items-center justify-center py-12 px-6 text-center', className)}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="w-16 h-16 bg-purple-500/10 rounded-full flex items-center justify-center mb-4">
          <Settings className="w-8 h-8 text-purple-500" />
        </div>

        <h3 className="text-lg font-semibold text-bolt-elements-textPrimary mb-2">No Custom Prompts</h3>

        <p className="text-bolt-elements-textSecondary mb-6 max-w-md">
          Custom prompts are currently disabled. Only built-in prompts are available.
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-bolt-elements-textPrimary">Your Custom Prompts</h3>
          <p className="text-sm text-bolt-elements-textSecondary">
            View your personal AI assistant prompts (editing disabled)
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {customPrompts.map((prompt, index) => (
          <motion.div
            key={prompt.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="hover:shadow-md transition-shadow duration-200">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center">
                      <Settings className="w-5 h-5 text-purple-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base font-semibold text-bolt-elements-textPrimary truncate">
                        {prompt.label}
                      </CardTitle>
                      <p className="text-sm text-bolt-elements-textSecondary line-clamp-2">{prompt.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 ml-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeletePrompt(prompt)}
                      className="w-8 h-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-0">
                <div className="flex items-center gap-2 mb-3">
                  <Badge variant={TOKEN_USAGE_CONFIG[prompt.tokenUsage].color as any} size="sm">
                    {TOKEN_USAGE_CONFIG[prompt.tokenUsage].label}
                  </Badge>
                  <Badge variant={COMPLEXITY_CONFIG[prompt.complexity].color as any} size="sm">
                    {COMPLEXITY_CONFIG[prompt.complexity].label}
                  </Badge>
                </div>

                {prompt.features.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-medium text-bolt-elements-textSecondary uppercase tracking-wide mb-1">
                      Features
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {prompt.features.slice(0, 3).map((feature, idx) => (
                        <Badge key={idx} variant="outline" size="sm">
                          {feature}
                        </Badge>
                      ))}
                      {prompt.features.length > 3 && (
                        <Badge variant="outline" size="sm">
                          +{prompt.features.length - 3} more
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-4 text-xs text-bolt-elements-textTertiary">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Created {formatDate(prompt.createdAt)}
                  </div>
                  {prompt.updatedAt !== prompt.createdAt && (
                    <div className="flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Updated {formatDate(prompt.updatedAt)}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {customPrompts.length === 0 && (
        <div className="text-center py-8">
          <p className="text-bolt-elements-textSecondary">
            No custom prompts found. Create your first one to get started!
          </p>
        </div>
      )}
    </motion.div>
  );
};

CustomPromptManager.displayName = 'CustomPromptManager';
