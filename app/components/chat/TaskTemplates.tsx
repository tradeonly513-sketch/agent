import React, { useState } from 'react';
import { taskTemplates, getAllCategories, type TaskTemplate } from '~/lib/agent/templates';
import { classNames } from '~/utils/classNames';

interface TaskTemplatesProps {
  onSelectTemplate: (template: TaskTemplate) => void;
  className?: string;
}

export const TaskTemplates: React.FC<TaskTemplatesProps> = ({ onSelectTemplate, className }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [isExpanded, setIsExpanded] = useState(false);

  const categories = ['All', ...getAllCategories()];
  const filteredTemplates =
    selectedCategory === 'All' ? taskTemplates : taskTemplates.filter((t) => t.category === selectedCategory);

  const displayedTemplates = isExpanded ? filteredTemplates : filteredTemplates.slice(0, 6);

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner':
        return 'text-green-600 bg-green-100';
      case 'intermediate':
        return 'text-yellow-600 bg-yellow-100';
      case 'advanced':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className={classNames('w-full', className)}>
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-bolt-elements-textPrimary mb-2">Agent Task Templates</h3>
        <p className="text-sm text-bolt-elements-textSecondary mb-3">
          Choose a template to get started quickly with common development tasks
        </p>

        {/* Category Filter */}
        <div className="flex flex-wrap gap-2 mb-4">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={classNames(
                'px-3 py-1 text-xs rounded-full transition-colors',
                selectedCategory === category
                  ? 'bg-bolt-elements-button-primary-background text-bolt-elements-button-primary-text'
                  : 'bg-bolt-elements-background-depth-2 text-bolt-elements-textSecondary hover:bg-bolt-elements-background-depth-3',
              )}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
        {displayedTemplates.map((template) => (
          <div
            key={template.id}
            className="bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-lg p-4 hover:bg-bolt-elements-background-depth-3 transition-colors cursor-pointer"
            onClick={() => onSelectTemplate(template)}
          >
            <div className="flex items-start justify-between mb-2">
              <h4 className="text-sm font-medium text-bolt-elements-textPrimary line-clamp-1">{template.title}</h4>
              <span
                className={classNames(
                  'px-2 py-1 text-xs rounded-full flex-shrink-0 ml-2',
                  getDifficultyColor(template.difficulty),
                )}
              >
                {template.difficulty}
              </span>
            </div>

            <p className="text-xs text-bolt-elements-textSecondary mb-3 line-clamp-2">{template.description}</p>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-bolt-elements-textTertiary">
                <span className="flex items-center gap-1">
                  <div className="i-ph:list-bullets" />
                  {template.estimatedSteps} steps
                </span>
                <span className="flex items-center gap-1">
                  <div className="i-ph:folder" />
                  {template.category}
                </span>
              </div>
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-1 mt-2">
              {template.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="px-1.5 py-0.5 text-xs bg-bolt-elements-background-depth-1 text-bolt-elements-textTertiary rounded"
                >
                  {tag}
                </span>
              ))}
              {template.tags.length > 3 && (
                <span className="px-1.5 py-0.5 text-xs text-bolt-elements-textTertiary">
                  +{template.tags.length - 3}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Show More/Less Button */}
      {filteredTemplates.length > 6 && (
        <div className="text-center">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="px-4 py-2 text-sm bg-bolt-elements-background-depth-2 text-bolt-elements-textSecondary hover:bg-bolt-elements-background-depth-3 rounded-lg transition-colors"
          >
            {isExpanded ? 'Show Less' : `Show ${filteredTemplates.length - 6} More`}
          </button>
        </div>
      )}
    </div>
  );
};

export default TaskTemplates;
