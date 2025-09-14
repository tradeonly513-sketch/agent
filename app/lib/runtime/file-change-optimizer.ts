import { createScopedLogger } from '~/utils/logger';
import type { FileMap } from '~/lib/stores/files';
import { diffLines, createPatch } from 'diff';

const logger = createScopedLogger('FileChangeOptimizer');

export interface FileChangeAnalysis {
  needsChange: boolean;
  reason: string;
  changeType: 'create' | 'modify' | 'skip';
  similarity: number; // 0..1
  changePercentage: number; // 0..100
}

export interface OptimizationResult {
  optimizedFiles: FileMap;
  skippedFiles: string[];
  modifiedFiles: string[];
  createdFiles: string[];
  analysis: Map<string, FileChangeAnalysis>;
  optimizationRate: number; // percentage of proposed files skipped
}

export class FileChangeOptimizer {
  // Configurable thresholds (conservative defaults)
  private _similarityThreshold = 0.95; // >= 95% similar => likely skip
  private _minimalChangeThreshold = 2; // < 2% change => skip

  async optimizeFileChanges(
    proposedChanges: FileMap,
    existingFiles: FileMap,
    userRequest: string,
  ): Promise<OptimizationResult> {
    const optimizedFiles: FileMap = {};
    const skippedFiles: string[] = [];
    const modifiedFiles: string[] = [];
    const createdFiles: string[] = [];
    const analysis: Map<string, FileChangeAnalysis> = new Map();

    const intent = this.analyzeUserIntent(userRequest);

    for (const [path, dirent] of Object.entries(proposedChanges)) {
      const proposed = dirent?.type === 'file' ? dirent.content : '';
      const existingDirent = existingFiles[path];
      const existing = existingDirent?.type === 'file' ? existingDirent.content : undefined;

      const fileType = this.getFileType(path);
      const sim = this.computeLineSimilarity(existing ?? '', proposed);
      const changePct = this.computeChangePercentage(existing ?? '', proposed);

      // New file
      if (existing === undefined) {
        // Avoid empty or doc-only accidental creations unless explicitly requested
        if (this.isProbablyUnnecessaryCreation(path, proposed, intent)) {
          analysis.set(path, {
            needsChange: false,
            reason: 'Unnecessary new file for current request',
            changeType: 'skip',
            similarity: 0,
            changePercentage: 100,
          });
          skippedFiles.push(path);
          continue;
        }

        optimizedFiles[path] = dirent;
        createdFiles.push(path);
        analysis.set(path, {
          needsChange: true,
          reason: 'New file creation',
          changeType: 'create',
          similarity: 0,
          changePercentage: 100,
        });
        continue;
      }

      // Whitespace-only: disable for whitespace-significant types
      if (!this.isWhitespaceSignificant(fileType) && this.isWhitespaceOnlyChange(existing, proposed)) {
        analysis.set(path, {
          needsChange: false,
          reason: 'Whitespace-only changes',
          changeType: 'skip',
          similarity: 1,
          changePercentage: 0,
        });
        skippedFiles.push(path);
        continue;
      }

      // Comment-only changes
      if (this.isCommentOnlyChange(existing, proposed, fileType)) {
        analysis.set(path, {
          needsChange: false,
          reason: 'Comment-only changes',
          changeType: 'skip',
          similarity: sim,
          changePercentage: changePct,
        });
        skippedFiles.push(path);
        continue;
      }

      // Minimal changes or high similarity
      if (changePct < this._minimalChangeThreshold || sim >= this._similarityThreshold) {
        // Allow through if intent suggests small targeted fix and file has logic-like edits
        if (intent.isBugFix && this.seemsLikeLogicChange(path, existing, proposed)) {
          optimizedFiles[path] = dirent;
          modifiedFiles.push(path);
          analysis.set(path, {
            needsChange: true,
            reason: 'Targeted bug-fix change',
            changeType: 'modify',
            similarity: sim,
            changePercentage: changePct,
          });
        } else {
          analysis.set(path, {
            needsChange: false,
            reason:
              sim >= this._similarityThreshold
                ? `High similarity ${(sim * 100).toFixed(1)}%`
                : `Minimal change ${changePct.toFixed(1)}%`,
            changeType: 'skip',
            similarity: sim,
            changePercentage: changePct,
          });
          skippedFiles.push(path);
        }

        continue;
      }

      // Relevant-to-intent filter (soft)
      if (!this.isRelevantToIntent(path, existing, proposed, intent)) {
        analysis.set(path, {
          needsChange: false,
          reason: 'Not relevant to current request',
          changeType: 'skip',
          similarity: sim,
          changePercentage: changePct,
        });
        skippedFiles.push(path);
        continue;
      }

      // Apply change
      optimizedFiles[path] = dirent;
      modifiedFiles.push(path);
      analysis.set(path, {
        needsChange: true,
        reason: 'Significant relevant changes',
        changeType: 'modify',
        similarity: sim,
        changePercentage: changePct,
      });
    }

    const total = Object.keys(proposedChanges).length || 1;
    const optimizationRate = (skippedFiles.length / total) * 100;

    logger.debug('[FileChangeOptimizer] summary', {
      analyzed: total,
      written: Object.keys(optimizedFiles).length,
      skipped: skippedFiles.length,
      optimizationRate: `${optimizationRate.toFixed(1)}%`,
    });

    return { optimizedFiles, skippedFiles, modifiedFiles, createdFiles, analysis, optimizationRate };
  }

  // --- intent & heuristics -------------------------------------------------

  analyzeUserIntent(request: string) {
    const r = request.toLowerCase();
    return {
      isBugFix: /\bfix|bug|error|crash|throw\b/.test(r),
      isFeature: /\bfeature|add|implement\b/.test(r),
      isRefactor: /\brefactor|optimi[sz]e|clean\b/.test(r),
      targetFiles: (request.match(/[\w\-/]+\.[\w]+/g) || []).map((s) => s.toLowerCase()),
    } as const;
  }

  isRelevantToIntent(path: string, oldC: string, newC: string, intent: ReturnType<typeof this.analyzeUserIntent>) {
    const p = path.toLowerCase();

    if (intent.targetFiles.length > 0) {
      return intent.targetFiles.some((t) => p.includes(t));
    }

    if (intent.isBugFix) {
      // Look for code-like changes in patch
      const patch = createPatch(path, oldC, newC);
      return /\b(function|class|if|return|throw|catch|await|async)\b/.test(patch);
    }

    return true;
  }

  seemsLikeLogicChange(path: string, oldC: string, newC: string) {
    const patch = createPatch(path, oldC, newC);
    return /\b(function|class|if|return|throw|catch|await|async|=>)\b/.test(patch);
  }

  // --- diff & similarity ---------------------------------------------------

  computeChangePercentage(oldC: string, newC: string) {
    if (oldC === newC) {
      return 0;
    }

    const oldLines = oldC.split('\n').length;
    const newLines = newC.split('\n').length;
    const totalLines = Math.max(1, Math.max(oldLines, newLines));

    let added = 0;
    let removed = 0;

    for (const part of diffLines(oldC, newC)) {
      const lines = Math.max(0, part.value.split('\n').length - 1);

      if (part.added) {
        added += lines;
      } else if (part.removed) {
        removed += lines;
      }
    }

    const changes = added + removed;

    return (changes / totalLines) * 100;
  }

  computeLineSimilarity(oldC: string, newC: string) {
    if (oldC === newC) {
      return 1;
    }

    const oldLines = oldC.split('\n').length;
    const newLines = newC.split('\n').length;
    const totalLines = Math.max(1, Math.max(oldLines, newLines));

    let added = 0;
    let removed = 0;

    for (const part of diffLines(oldC, newC)) {
      const lines = Math.max(0, part.value.split('\n').length - 1);

      if (part.added) {
        added += lines;
      } else if (part.removed) {
        removed += lines;
      }
    }

    const changes = added + removed;
    const similarity = 1 - Math.min(1, changes / totalLines);

    return similarity;
  }

  // --- language-aware helpers ---------------------------------------------

  isWhitespaceOnlyChange(oldC: string, newC: string) {
    const normalize = (s: string) => s.replace(/\s+/g, ' ').trim();
    return normalize(oldC) === normalize(newC);
  }

  isWhitespaceSignificant(ext: string) {
    return ext === 'py' || ext === 'yaml' || ext === 'yml' || ext === 'makefile';
  }

  isCommentOnlyChange(oldC: string, newC: string, ext: string) {
    const strip = (s: string) => {
      switch (ext) {
        case 'js':
        case 'ts':
        case 'jsx':
        case 'tsx':
          return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
        case 'css':
        case 'scss':
          return s.replace(/\/\*[\s\S]*?\*\//g, '');
        case 'html':
        case 'xml':
          return s.replace(/<!--([\s\S]*?)-->/g, '');
        case 'py':
        case 'sh':
        case 'rb':
          return s.replace(/(^|\s)#.*$/gm, '');
        default:
          return s;
      }
    };
    return strip(oldC).trim() === strip(newC).trim();
  }

  getFileType(path: string) {
    const last = path.split('/').pop() || '';
    const parts = last.split('.');

    return parts.length > 1 ? parts.pop()!.toLowerCase() : '';
  }

  isProbablyUnnecessaryCreation(path: string, content: string, intent: ReturnType<typeof this.analyzeUserIntent>) {
    const ext = this.getFileType(path);

    if ((ext === 'md' || ext === 'txt') && !/readme|doc/i.test(intentText(intent))) {
      return true;
    }

    if (/\.test\.|\.spec\./.test(path) && !/test/i.test(intentText(intent))) {
      return true;
    }

    if (content.trim().length < 50) {
      return true;
    }

    return false;
  }
}

function intentText(intent: ReturnType<FileChangeOptimizer['analyzeUserIntent']>) {
  return [intent.isBugFix ? 'bug' : '', intent.isFeature ? 'feature' : '', intent.isRefactor ? 'refactor' : '']
    .filter(Boolean)
    .join(' ');
}

export const fileChangeOptimizer = new FileChangeOptimizer();
