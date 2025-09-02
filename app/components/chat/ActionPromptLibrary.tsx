import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search, X, BookOpen, ArrowRight } from 'lucide-react';
import { Dialog, DialogRoot, DialogTitle, DialogDescription } from '~/components/ui/Dialog';
import { Badge } from '~/components/ui/Badge';
import { ScrollArea } from '~/components/ui/ScrollArea';
import { Button } from '~/components/ui/Button';
import { classNames } from '~/utils/classNames';
import {
  ACTION_PROMPTS,
  PROMPT_CATEGORIES,
  searchPrompts,
  getPromptsByCategory,
  type ActionPrompt,
} from '~/lib/data/action-prompts';

interface ActionPromptLibraryProps {
  isOpen: boolean;
  onClose: () => void;
  onPromptSelect: (prompt: string) => void;
}

export const ActionPromptLibrary: React.FC<ActionPromptLibraryProps> = ({ isOpen, onClose, onPromptSelect }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Filter prompts based on search and category
  const filteredPrompts = useMemo(() => {
    let prompts = ACTION_PROMPTS;

    if (selectedCategory) {
      prompts = getPromptsByCategory(selectedCategory);
    }

    if (searchQuery.trim()) {
      prompts = searchPrompts(searchQuery);

      if (selectedCategory) {
        prompts = prompts.filter((p) => p.category === selectedCategory);
      }
    }

    return prompts;
  }, [searchQuery, selectedCategory]);

  // Group prompts by category for display
  const groupedPrompts = useMemo(() => {
    const groups: Record<string, ActionPrompt[]> = {};

    filteredPrompts.forEach((prompt) => {
      if (!groups[prompt.category]) {
        groups[prompt.category] = [];
      }

      groups[prompt.category].push(prompt);
    });

    return groups;
  }, [filteredPrompts]);

  const handlePromptSelect = (prompt: ActionPrompt) => {
    onPromptSelect(prompt.prompt);
    onClose();
  };

  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategory(selectedCategory === categoryId ? null : categoryId);
  };

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedCategory(null);
  };

  const categoryData = PROMPT_CATEGORIES.find((cat) => cat.id === selectedCategory);

  return (
    <DialogRoot open={isOpen} onOpenChange={onClose}>
      <Dialog className="max-w-4xl w-[90vw] max-h-[80vh]" showCloseButton={false} onBackdrop={onClose}>
        <div className="flex flex-col h-full max-h-[80vh]">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-bolt-elements-borderColor">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-semibold">Action Prompt Library</DialogTitle>
                <DialogDescription className="mt-1">
                  Choose from categorized prompts to enhance your project
                </DialogDescription>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-bolt-elements-textTertiary hover:text-bolt-elements-textSecondary"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Search and Filters */}
          <div className="p-6 border-b border-bolt-elements-borderColor bg-bolt-elements-background-depth-1">
            <div className="space-y-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-bolt-elements-textTertiary" />
                <input
                  type="text"
                  placeholder="Search prompts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-lg text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              {/* Category Filters */}
              <div className="flex flex-wrap gap-2">
                {PROMPT_CATEGORIES.map((category) => {
                  const Icon = category.icon;
                  const isSelected = selectedCategory === category.id;
                  const count = getPromptsByCategory(category.id).length;

                  return (
                    <button
                      key={category.id}
                      onClick={() => handleCategorySelect(category.id)}
                      className={classNames(
                        'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all border',
                        isSelected
                          ? 'bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent border-bolt-elements-item-contentAccent'
                          : 'bg-bolt-elements-background-depth-2 text-bolt-elements-textSecondary border-bolt-elements-borderColor hover:bg-bolt-elements-item-backgroundActive hover:text-bolt-elements-textPrimary',
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{category.title}</span>
                      <Badge variant="secondary" className="ml-1 text-xs">
                        {count}
                      </Badge>
                    </button>
                  );
                })}

                {(searchQuery || selectedCategory) && (
                  <button
                    onClick={resetFilters}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-bolt-elements-background-depth-2 text-bolt-elements-textTertiary border border-bolt-elements-borderColor hover:bg-bolt-elements-item-backgroundActive hover:text-bolt-elements-textPrimary transition-all"
                  >
                    <X className="w-4 h-4" />
                    Clear filters
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-6">
                {selectedCategory && categoryData && (
                  <div className="mb-6 p-4 rounded-lg bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-bolt-elements-borderColor">
                    <div className="flex items-center gap-3 mb-2">
                      <categoryData.icon className={classNames('w-5 h-5', categoryData.color)} />
                      <h3 className="font-semibold text-bolt-elements-textPrimary">{categoryData.title}</h3>
                    </div>
                    <p className="text-sm text-bolt-elements-textSecondary">{categoryData.description}</p>
                  </div>
                )}

                {filteredPrompts.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-bolt-elements-background-depth-2 flex items-center justify-center">
                      <Search className="w-8 h-8 text-bolt-elements-textTertiary" />
                    </div>
                    <h3 className="text-lg font-medium text-bolt-elements-textPrimary mb-2">No prompts found</h3>
                    <p className="text-bolt-elements-textSecondary">
                      Try adjusting your search terms or clearing the filters.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {Object.entries(groupedPrompts).map(([categoryId, prompts]) => {
                      const category = PROMPT_CATEGORIES.find((cat) => cat.id === categoryId);

                      if (!category || prompts.length === 0) {
                        return null;
                      }

                      return (
                        <div key={categoryId} className="space-y-4">
                          {!selectedCategory && (
                            <div className="flex items-center gap-3">
                              <category.icon className={classNames('w-5 h-5', category.color)} />
                              <h3 className="font-semibold text-bolt-elements-textPrimary">{category.title}</h3>
                              <div className="flex-1 h-px bg-bolt-elements-borderColor" />
                              <Badge variant="secondary">{prompts.length}</Badge>
                            </div>
                          )}

                          <div className="grid gap-4 md:grid-cols-2">
                            {prompts.map((prompt) => {
                              const Icon = prompt.icon;

                              return (
                                <motion.div
                                  key={prompt.id}
                                  initial={{ opacity: 0, y: 20 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  className="group p-4 rounded-lg border border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 hover:bg-bolt-elements-item-backgroundActive hover:border-bolt-elements-item-contentAccent transition-all cursor-pointer"
                                  onClick={() => handlePromptSelect(prompt)}
                                >
                                  <div className="flex items-start gap-3">
                                    <div className="p-2 rounded-lg bg-bolt-elements-background-depth-3 group-hover:bg-bolt-elements-item-backgroundAccent group-hover:text-bolt-elements-item-contentAccent transition-all">
                                      <Icon className="w-4 h-4" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <h4 className="font-medium text-bolt-elements-textPrimary group-hover:text-bolt-elements-item-contentAccent transition-colors">
                                        {prompt.title}
                                      </h4>
                                      <p className="text-sm text-bolt-elements-textSecondary mt-1 line-clamp-2">
                                        {prompt.description}
                                      </p>
                                      <div className="flex items-center gap-2 mt-3">
                                        <div className="flex gap-1">
                                          {prompt.tags.slice(0, 3).map((tag) => (
                                            <Badge key={tag} variant="outline" className="text-xs">
                                              {tag}
                                            </Badge>
                                          ))}
                                        </div>
                                        <ArrowRight className="w-4 h-4 text-bolt-elements-textTertiary group-hover:text-bolt-elements-item-contentAccent transition-colors ml-auto" />
                                      </div>
                                    </div>
                                  </div>
                                </motion.div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-bolt-elements-borderColor bg-bolt-elements-background-depth-1">
            <div className="flex items-center justify-between text-sm text-bolt-elements-textSecondary">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                <span>{filteredPrompts.length} prompts available</span>
              </div>
              <div className="flex items-center gap-4">
                <span>Click any prompt to use it in your chat</span>
                <Button variant="outline" size="sm" onClick={onClose}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Dialog>
    </DialogRoot>
  );
};
