import React from 'react';
import { Input } from '~/components/ui';
import { classNames } from '~/utils/classNames';
import { Plus, Lock, Globe } from 'lucide-react';

interface NewRepositoryFormProps {
  repoName: string;
  onRepoNameChange: (name: string) => void;
  isPrivate: boolean;
  onPrivateChange: (isPrivate: boolean) => void;
  description?: string;
  onDescriptionChange?: (description: string) => void;
  isSubmitting?: boolean;
  onSubmit: (e: React.FormEvent) => void;
  error?: string;
  className?: string;
}

export function NewRepositoryForm({
  repoName,
  onRepoNameChange,
  isPrivate,
  onPrivateChange,
  description,
  onDescriptionChange,
  isSubmitting = false,
  onSubmit,
  error,
  className = '',
}: NewRepositoryFormProps) {
  /*
   * Validation function for future use
   * const isValidRepoName = (name: string) => {
   *   if (!name) {
   *     return false;
   *   }
   *   if (name.length < 1 || name.length > 100) {
   *     return false;
   *   }
   *   // GitHub repository name validation
   *   return /^[a-zA-Z0-9._-]+$/.test(name);
   * };
   */

  const validateRepoName = (name: string) => {
    if (!name) {
      return 'Repository name is required';
    }

    if (name.length < 1) {
      return 'Repository name cannot be empty';
    }

    if (name.length > 100) {
      return 'Repository name cannot exceed 100 characters';
    }

    if (!/^[a-zA-Z0-9._-]+$/.test(name)) {
      return 'Repository name can only contain alphanumeric characters, periods, hyphens, and underscores';
    }

    if (name.startsWith('.') || name.endsWith('.')) {
      return 'Repository name cannot start or end with a period';
    }

    if (name.startsWith('-') || name.endsWith('-')) {
      return 'Repository name cannot start or end with a hyphen';
    }

    return null;
  };

  const nameError = validateRepoName(repoName);
  const canSubmit = !nameError && repoName.trim() !== '' && !isSubmitting;

  return (
    <form onSubmit={onSubmit} className={`space-y-4 ${className}`}>
      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-700">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      <div>
        <label htmlFor="repoName" className="block text-sm font-medium text-bolt-elements-textPrimary mb-2">
          Repository Name
        </label>
        <Input
          id="repoName"
          type="text"
          value={repoName}
          onChange={(e) => onRepoNameChange(e.target.value)}
          placeholder="my-awesome-project"
          disabled={isSubmitting}
          className={classNames(nameError && repoName ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : '')}
        />
        {nameError && repoName && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{nameError}</p>}
        {!nameError && repoName && (
          <p className="mt-1 text-xs text-green-600 dark:text-green-400">✓ Valid repository name</p>
        )}
      </div>

      {onDescriptionChange && (
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-bolt-elements-textPrimary mb-2">
            Description (Optional)
          </label>
          <Input
            id="description"
            type="text"
            value={description || ''}
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder="A brief description of your project"
            disabled={isSubmitting}
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-bolt-elements-textPrimary mb-3">Repository Visibility</label>
        <div className="space-y-2">
          <label className="flex items-center cursor-pointer">
            <input
              type="radio"
              name="visibility"
              checked={!isPrivate}
              onChange={() => onPrivateChange(false)}
              disabled={isSubmitting}
              className="sr-only"
            />
            <div
              className={classNames(
                'flex items-center gap-3 p-3 rounded-lg border-2 transition-all duration-200',
                !isPrivate
                  ? 'border-bolt-elements-item-contentAccent bg-bolt-elements-item-contentAccent/5'
                  : 'border-bolt-elements-borderColor hover:border-bolt-elements-borderColorActive',
                isSubmitting ? 'opacity-50 cursor-not-allowed' : '',
              )}
            >
              <Globe className="w-4 h-4 text-bolt-elements-textSecondary" />
              <div>
                <div className="text-sm font-medium text-bolt-elements-textPrimary">Public</div>
                <div className="text-xs text-bolt-elements-textSecondary">Anyone can see this repository</div>
              </div>
            </div>
          </label>

          <label className="flex items-center cursor-pointer">
            <input
              type="radio"
              name="visibility"
              checked={isPrivate}
              onChange={() => onPrivateChange(true)}
              disabled={isSubmitting}
              className="sr-only"
            />
            <div
              className={classNames(
                'flex items-center gap-3 p-3 rounded-lg border-2 transition-all duration-200',
                isPrivate
                  ? 'border-bolt-elements-item-contentAccent bg-bolt-elements-item-contentAccent/5'
                  : 'border-bolt-elements-borderColor hover:border-bolt-elements-borderColorActive',
                isSubmitting ? 'opacity-50 cursor-not-allowed' : '',
              )}
            >
              <Lock className="w-4 h-4 text-bolt-elements-textSecondary" />
              <div>
                <div className="text-sm font-medium text-bolt-elements-textPrimary">Private</div>
                <div className="text-xs text-bolt-elements-textSecondary">Only you can see this repository</div>
              </div>
            </div>
          </label>
        </div>
      </div>

      <button
        type="submit"
        disabled={!canSubmit}
        className={classNames(
          'w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200',
          canSubmit
            ? 'bg-bolt-elements-item-contentAccent text-white hover:bg-bolt-elements-item-contentAccent/90'
            : 'bg-bolt-elements-background-depth-2 text-bolt-elements-textTertiary cursor-not-allowed',
          isSubmitting ? 'cursor-wait' : '',
        )}
      >
        {isSubmitting ? (
          <>
            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            Creating Repository...
          </>
        ) : (
          <>
            <Plus className="w-4 h-4" />
            Create Repository
          </>
        )}
      </button>
    </form>
  );
}
