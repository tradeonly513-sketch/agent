import type { WebContainer } from '@webcontainer/api';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('PredictiveDirectoryCreator');

interface ProjectPattern {
  name: string;
  indicators: string[];
  predictedDirectories: string[];
  confidence: number;
}

interface PredictionStats {
  totalPredictions: number;
  successfulPredictions: number;
  redundantPredictions: number;
  accuracy: number;
  lastPrediction: Date | null;
}

/**
 * Analyzes file patterns and predictively creates likely directory structures
 * to reduce future directory creation overhead.
 */
export class PredictiveDirectoryCreator {
  private _webcontainer: Promise<WebContainer>;
  private _stats: PredictionStats;
  private _recentFiles = new Set<string>();
  private _maxRecentFiles = 100;
  private _predictionCache = new Map<string, { directories: string[]; timestamp: number }>();
  private _cacheExpiry = 10 * 60 * 1000; // 10 minutes

  // Common project patterns and their typical directory structures
  private _projectPatterns: ProjectPattern[] = [
    {
      name: 'React Project',
      indicators: ['package.json', 'src/App.jsx', 'src/App.tsx', 'public/index.html'],
      predictedDirectories: [
        'src/components',
        'src/pages',
        'src/hooks',
        'src/utils',
        'src/services',
        'src/styles',
        'src/assets',
        'src/context',
        'public/images',
        'public/icons',
      ],
      confidence: 0.85,
    },
    {
      name: 'Next.js Project',
      indicators: ['next.config.js', 'pages/_app.js', 'pages/index.js', 'app/layout.tsx'],
      predictedDirectories: [
        'pages/api',
        'components',
        'lib',
        'utils',
        'styles',
        'public/images',
        'hooks',
        'context',
        'types',
        'app/components',
        'app/api',
      ],
      confidence: 0.9,
    },
    {
      name: 'Vue.js Project',
      indicators: ['vue.config.js', 'src/main.js', 'src/App.vue', 'package.json'],
      predictedDirectories: [
        'src/components',
        'src/views',
        'src/router',
        'src/store',
        'src/assets',
        'src/utils',
        'src/services',
        'src/mixins',
        'public/img',
      ],
      confidence: 0.85,
    },
    {
      name: 'Node.js Backend',
      indicators: ['server.js', 'app.js', 'index.js', 'src/index.ts'],
      predictedDirectories: [
        'src/routes',
        'src/controllers',
        'src/models',
        'src/middleware',
        'src/services',
        'src/utils',
        'src/config',
        'tests',
        'public',
        'uploads',
      ],
      confidence: 0.8,
    },
    {
      name: 'Express.js API',
      indicators: ['app.js', 'server.js', 'routes/', 'package.json'],
      predictedDirectories: [
        'routes/api',
        'controllers',
        'middleware',
        'models',
        'services',
        'utils',
        'config',
        'tests/unit',
        'tests/integration',
        'public/uploads',
      ],
      confidence: 0.85,
    },
    {
      name: 'Full Stack Application',
      indicators: ['client/', 'server/', 'package.json', 'docker-compose.yml'],
      predictedDirectories: [
        'client/src/components',
        'client/src/pages',
        'client/public',
        'server/routes',
        'server/models',
        'server/controllers',
        'shared/types',
        'shared/utils',
        'docs',
        'tests',
      ],
      confidence: 0.8,
    },
    {
      name: 'TypeScript Project',
      indicators: ['tsconfig.json', 'src/index.ts', 'package.json'],
      predictedDirectories: [
        'src/types',
        'src/interfaces',
        'src/utils',
        'src/services',
        'src/constants',
        'dist',
        'tests',
        '@types',
      ],
      confidence: 0.75,
    },
  ];

  constructor(webcontainer: Promise<WebContainer>) {
    this._webcontainer = webcontainer;
    this._stats = {
      totalPredictions: 0,
      successfulPredictions: 0,
      redundantPredictions: 0,
      accuracy: 0,
      lastPrediction: null,
    };

    logger.debug(
      'PredictiveDirectoryCreator initialized with patterns:',
      this._projectPatterns.map((p) => p.name),
    );
  }

  /**
   * Analyze a new file and make predictions about likely directory structures
   */
  async analyzeAndPredict(filePath: string): Promise<void> {
    // Add to recent files for pattern analysis
    this._recentFiles.add(filePath);

    // Keep recent files list manageable
    if (this._recentFiles.size > this._maxRecentFiles) {
      const firstFile = this._recentFiles.values().next().value;

      if (firstFile) {
        this._recentFiles.delete(firstFile);
      }
    }

    // Check cache first
    const cacheKey = this._generateCacheKey();
    const cached = this._predictionCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this._cacheExpiry) {
      logger.debug('Using cached directory predictions');
      return;
    }

    // Analyze patterns and make predictions
    const patterns = this._detectProjectPatterns();

    if (patterns.length > 0) {
      const directoriesToCreate = this._generatePredictions(patterns);

      if (directoriesToCreate.length > 0) {
        await this._createPredictedDirectories(directoriesToCreate);

        // Cache the predictions
        this._predictionCache.set(cacheKey, {
          directories: directoriesToCreate,
          timestamp: Date.now(),
        });

        this._stats.totalPredictions++;
        this._stats.lastPrediction = new Date();
      }
    }
  }

  /**
   * Detect which project patterns match the current file structure
   */
  private _detectProjectPatterns(): ProjectPattern[] {
    const recentFilesArray = Array.from(this._recentFiles);
    const matchedPatterns: ProjectPattern[] = [];

    for (const pattern of this._projectPatterns) {
      let matchCount = 0;

      for (const indicator of pattern.indicators) {
        if (recentFilesArray.some((file) => file.includes(indicator) || file.endsWith(indicator))) {
          matchCount++;
        }
      }

      // Calculate confidence based on how many indicators match
      const matchRatio = matchCount / pattern.indicators.length;
      const adjustedConfidence = pattern.confidence * matchRatio;

      // Include pattern if confidence is high enough
      if (adjustedConfidence > 0.5) {
        matchedPatterns.push({
          ...pattern,
          confidence: adjustedConfidence,
        });
      }
    }

    // Sort by confidence (highest first)
    matchedPatterns.sort((a, b) => b.confidence - a.confidence);

    logger.debug(
      `Detected ${matchedPatterns.length} matching patterns:`,
      matchedPatterns.map((p) => `${p.name} (${(p.confidence * 100).toFixed(1)}%)`),
    );

    return matchedPatterns;
  }

  /**
   * Generate directory predictions from matched patterns
   */
  private _generatePredictions(patterns: ProjectPattern[]): string[] {
    const allPredictions = new Set<string>();

    // Combine predictions from all matched patterns
    for (const pattern of patterns) {
      for (const directory of pattern.predictedDirectories) {
        // Weight by confidence - only include high-confidence predictions
        if (pattern.confidence > 0.7) {
          allPredictions.add(directory);
        }
      }
    }

    // Filter out directories that likely already exist based on recent files
    const filteredPredictions = Array.from(allPredictions).filter((dir) => {
      return !Array.from(this._recentFiles).some((file) => file.startsWith(dir + '/'));
    });

    logger.debug(`Generated ${filteredPredictions.length} directory predictions:`, filteredPredictions);

    return filteredPredictions;
  }

  /**
   * Create predicted directories in the WebContainer
   */
  private async _createPredictedDirectories(directories: string[]): Promise<void> {
    const webcontainer = await this._webcontainer;

    let successCount = 0;
    let redundantCount = 0;

    // Create directories in parallel for better performance
    const createPromises = directories.map(async (dirPath) => {
      try {
        // Check if directory already exists
        try {
          await webcontainer.fs.readdir(dirPath);
          redundantCount++;
          logger.debug(`Directory already exists: ${dirPath}`);

          return;
        } catch {
          // Directory doesn't exist, create it
        }

        await webcontainer.fs.mkdir(dirPath, { recursive: true });
        successCount++;
        logger.debug(`Predictively created directory: ${dirPath}`);
      } catch (error) {
        logger.warn(`Failed to create predicted directory ${dirPath}:`, error);
      }
    });

    await Promise.all(createPromises);

    // Update statistics
    this._stats.successfulPredictions += successCount;
    this._stats.redundantPredictions += redundantCount;
    this._updateAccuracy();

    if (successCount > 0) {
      logger.info(`Predictively created ${successCount} directories, ${redundantCount} were redundant`);
    }
  }

  /**
   * Generate cache key based on recent files
   */
  private _generateCacheKey(): string {
    const sortedFiles = Array.from(this._recentFiles).sort();
    const keyFiles = sortedFiles.slice(-10);

    // Use last 10 files for cache key
    return keyFiles.join('|');
  }

  /**
   * Update prediction accuracy statistics
   */
  private _updateAccuracy(): void {
    if (this._stats.totalPredictions > 0) {
      this._stats.accuracy = this._stats.successfulPredictions / this._stats.totalPredictions;
    }
  }

  /**
   * Force analysis of all recent files to make comprehensive predictions
   */
  async performComprehensiveAnalysis(): Promise<void> {
    logger.info('Performing comprehensive directory analysis...');

    const patterns = this._detectProjectPatterns();

    if (patterns.length > 0) {
      const directoriesToCreate = this._generatePredictions(patterns);

      if (directoriesToCreate.length > 0) {
        await this._createPredictedDirectories(directoriesToCreate);
        this._stats.totalPredictions++;
        this._stats.lastPrediction = new Date();
      }
    }
  }

  /**
   * Get prediction statistics
   */
  getStats(): PredictionStats & {
    recentFilesCount: number;
    detectedPatterns: string[];
    cacheSize: number;
  } {
    const patterns = this._detectProjectPatterns();

    return {
      ...this._stats,
      recentFilesCount: this._recentFiles.size,
      detectedPatterns: patterns.map((p) => `${p.name} (${(p.confidence * 100).toFixed(1)}%)`),
      cacheSize: this._predictionCache.size,
    };
  }

  /**
   * Clear prediction cache and reset analysis
   */
  clearCache(): void {
    this._predictionCache.clear();
    this._recentFiles.clear();
    logger.debug('Prediction cache cleared');
  }

  /**
   * Add custom project pattern
   */
  addCustomPattern(pattern: ProjectPattern): void {
    this._projectPatterns.push(pattern);
    logger.debug(`Added custom pattern: ${pattern.name}`);
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this._stats = {
      totalPredictions: 0,
      successfulPredictions: 0,
      redundantPredictions: 0,
      accuracy: 0,
      lastPrediction: null,
    };
  }
}
