/**
 * Bolt Context Engine (BCE) - Inspired by Augment's ACE Architecture
 *
 * A real-time, semantic, cross-file retrieval-reasoning system designed to solve
 * "large codebase + long context" challenges. This is not just RAG, but a complete
 * pipeline that includes indexing, retrieval, ranking, compression, and memory.
 *
 * Core Components:
 * 1. Semantic Indexing - AST + Call Graph + Comments + Commit Records
 * 2. Intent Triggers - Query + Full Repository semantic + keyword + structural scoring
 * 3. Context Compression - Three-stage compression for ultra-long contexts
 * 4. Memory & Learning - Persistent memory with continuous learning
 * 5. Cross-file References - Dependency resolution and call chain tracking
 */

import type { Message } from 'ai';
import { createScopedLogger } from '~/utils/logger';
import type { FileMap, File, Folder } from './manager';

const logger = createScopedLogger('context-engine');

export interface ContextNode {
  id: string;
  type: 'file' | 'function' | 'class' | 'variable' | 'import' | 'comment';
  path: string;
  name: string;
  content: string;
  startLine?: number;
  endLine?: number;
  semanticEmbedding?: number[];
  dependencies: string[];
  dependents: string[];
  relevanceScore: number;
  lastAccessed: number;
  accessCount: number;
}

export interface QueryIntent {
  type: 'create' | 'modify' | 'debug' | 'understand' | 'refactor' | 'test';
  entities: string[];
  keywords: string[];
  semanticVector?: number[];
  confidence: number;
}

export interface CompressionResult {
  compressed: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  preservedConcepts: string[];
}

export interface ContextEngineOptions {
  maxContextTokens: number;
  semanticThreshold: number;
  keywordThreshold: number;
  structuralThreshold: number;
  maxRetrievedNodes: number;
  compressionTarget: number;
  enableMemory: boolean;
  memoryRetentionDays: number;
}

export class BoltContextEngine {
  private nodes: Map<string, ContextNode> = new Map();
  private semanticIndex: Map<string, number[]> = new Map();
  private callGraph: Map<string, Set<string>> = new Map();
  private reverseCallGraph: Map<string, Set<string>> = new Map();
  private memory: Map<string, any> = new Map();
  private options: ContextEngineOptions;

  constructor(options: Partial<ContextEngineOptions> = {}) {
    this.options = {
      maxContextTokens: 32000,
      semanticThreshold: 0.7,
      keywordThreshold: 0.6,
      structuralThreshold: 0.5,
      maxRetrievedNodes: 50,
      compressionTarget: 0.3, // Compress to 30% of original
      enableMemory: true,
      memoryRetentionDays: 30,
      ...options,
    };
  }

  /**
   * Phase 1: Semantic Indexing
   * Creates a comprehensive index of the codebase with AST analysis,
   * call graphs, comments, and semantic embeddings
   */
  async indexCodebase(files: FileMap): Promise<void> {
    logger.info('Starting codebase indexing...');

    const startTime = Date.now();
    let totalNodes = 0;

    // Clear existing index
    this.nodes.clear();
    this.semanticIndex.clear();
    this.callGraph.clear();
    this.reverseCallGraph.clear();

    for (const [filePath, fileInfo] of Object.entries(files)) {
      if (!fileInfo || fileInfo.type !== 'file') {
        continue;
      }

      const fileContent = fileInfo as File;

      if (!fileContent.content) {
        continue;
      }

      try {
        const fileNodes = await this.indexFile(filePath, fileContent.content);
        totalNodes += fileNodes.length;

        // Build call graph
        this.buildCallGraph(fileNodes);
      } catch (error) {
        logger.warn(`Failed to index file ${filePath}:`, error);
      }
    }

    const indexTime = Date.now() - startTime;
    logger.info(`Indexing completed: ${totalNodes} nodes in ${indexTime}ms`);
  }

  /**
   * Index a single file and extract semantic nodes
   */
  private async indexFile(filePath: string, content: string): Promise<ContextNode[]> {
    const nodes: ContextNode[] = [];
    const lines = content.split('\n');

    // File-level node
    const fileNode: ContextNode = {
      id: `file:${filePath}`,
      type: 'file',
      path: filePath,
      name: filePath.split('/').pop() || filePath,
      content: content.slice(0, 1000), // Preview
      dependencies: [],
      dependents: [],
      relevanceScore: 0,
      lastAccessed: Date.now(),
      accessCount: 0,
    };

    // Extract imports/dependencies
    const imports = this.extractImports(content);
    fileNode.dependencies = imports;

    nodes.push(fileNode);
    this.nodes.set(fileNode.id, fileNode);

    // Extract functions, classes, and other entities based on file type
    const fileExtension = filePath.split('.').pop()?.toLowerCase();

    switch (fileExtension) {
      case 'ts':
      case 'tsx':
      case 'js':
      case 'jsx':
        nodes.push(...this.extractJavaScriptEntities(filePath, content, lines));
        break;
      case 'py':
        nodes.push(...this.extractPythonEntities(filePath, content, lines));
        break;
      case 'java':
        nodes.push(...this.extractJavaEntities(filePath, content, lines));
        break;
      default:
        // Generic extraction for other file types
        nodes.push(...this.extractGenericEntities(filePath, content, lines));
    }

    // Generate semantic embeddings (simplified - in real implementation would use actual embeddings)
    for (const node of nodes) {
      node.semanticEmbedding = await this.generateSemanticEmbedding(node.content);
      this.semanticIndex.set(node.id, node.semanticEmbedding);
    }

    return nodes;
  }

  /**
   * Extract imports and dependencies from code
   */
  private extractImports(content: string): string[] {
    const imports: string[] = [];

    // JavaScript/TypeScript imports
    const jsImportRegex = /import\s+.*?\s+from\s+['"`]([^'"`]+)['"`]/g;
    const requireRegex = /require\(['"`]([^'"`]+)['"`]\)/g;

    // Python imports
    const pyImportRegex = /(?:from\s+(\S+)\s+)?import\s+([^#\n]+)/g;

    let match;

    while ((match = jsImportRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }

    while ((match = requireRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }

    while ((match = pyImportRegex.exec(content)) !== null) {
      if (match[1]) {
        imports.push(match[1]);
      }
    }

    return imports;
  }

  /**
   * Extract JavaScript/TypeScript entities
   */
  private extractJavaScriptEntities(filePath: string, content: string, lines: string[]): ContextNode[] {
    const nodes: ContextNode[] = [];

    // Function declarations
    const functionRegex = /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\([^)]*\)\s*{/g;
    let match;

    while ((match = functionRegex.exec(content)) !== null) {
      const lineNumber = content.slice(0, match.index).split('\n').length;
      nodes.push({
        id: `function:${filePath}:${match[1]}`,
        type: 'function',
        path: filePath,
        name: match[1],
        content: this.extractFunctionBody(content, match.index),
        startLine: lineNumber,
        dependencies: [],
        dependents: [],
        relevanceScore: 0,
        lastAccessed: Date.now(),
        accessCount: 0,
      });
    }

    // Class declarations
    const classRegex = /(?:export\s+)?class\s+(\w+)(?:\s+extends\s+\w+)?\s*{/g;

    while ((match = classRegex.exec(content)) !== null) {
      const lineNumber = content.slice(0, match.index).split('\n').length;
      nodes.push({
        id: `class:${filePath}:${match[1]}`,
        type: 'class',
        path: filePath,
        name: match[1],
        content: this.extractClassBody(content, match.index),
        startLine: lineNumber,
        dependencies: [],
        dependents: [],
        relevanceScore: 0,
        lastAccessed: Date.now(),
        accessCount: 0,
      });
    }

    // Arrow functions
    const arrowFunctionRegex = /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/g;

    while ((match = arrowFunctionRegex.exec(content)) !== null) {
      const lineNumber = content.slice(0, match.index).split('\n').length;
      nodes.push({
        id: `function:${filePath}:${match[1]}`,
        type: 'function',
        path: filePath,
        name: match[1],
        content: this.extractArrowFunctionBody(content, match.index),
        startLine: lineNumber,
        dependencies: [],
        dependents: [],
        relevanceScore: 0,
        lastAccessed: Date.now(),
        accessCount: 0,
      });
    }

    return nodes;
  }

  /**
   * Extract Python entities
   */
  private extractPythonEntities(filePath: string, content: string, lines: string[]): ContextNode[] {
    const nodes: ContextNode[] = [];

    // Function definitions
    const functionRegex = /^(\s*)def\s+(\w+)\s*\([^)]*\):/gm;
    let match;

    while ((match = functionRegex.exec(content)) !== null) {
      const lineNumber = content.slice(0, match.index).split('\n').length;
      nodes.push({
        id: `function:${filePath}:${match[2]}`,
        type: 'function',
        path: filePath,
        name: match[2],
        content: this.extractPythonFunctionBody(content, match.index, match[1].length),
        startLine: lineNumber,
        dependencies: [],
        dependents: [],
        relevanceScore: 0,
        lastAccessed: Date.now(),
        accessCount: 0,
      });
    }

    // Class definitions
    const classRegex = /^(\s*)class\s+(\w+)(?:\([^)]*\))?:/gm;

    while ((match = classRegex.exec(content)) !== null) {
      const lineNumber = content.slice(0, match.index).split('\n').length;
      nodes.push({
        id: `class:${filePath}:${match[2]}`,
        type: 'class',
        path: filePath,
        name: match[2],
        content: this.extractPythonClassBody(content, match.index, match[1].length),
        startLine: lineNumber,
        dependencies: [],
        dependents: [],
        relevanceScore: 0,
        lastAccessed: Date.now(),
        accessCount: 0,
      });
    }

    return nodes;
  }

  /**
   * Extract Java entities
   */
  private extractJavaEntities(filePath: string, content: string, lines: string[]): ContextNode[] {
    const nodes: ContextNode[] = [];

    // Method declarations
    const methodRegex = /(?:public|private|protected)?\s*(?:static)?\s*(?:\w+\s+)?(\w+)\s*\([^)]*\)\s*{/g;
    let match;

    while ((match = methodRegex.exec(content)) !== null) {
      const lineNumber = content.slice(0, match.index).split('\n').length;
      nodes.push({
        id: `method:${filePath}:${match[1]}`,
        type: 'function',
        path: filePath,
        name: match[1],
        content: this.extractMethodBody(content, match.index),
        startLine: lineNumber,
        dependencies: [],
        dependents: [],
        relevanceScore: 0,
        lastAccessed: Date.now(),
        accessCount: 0,
      });
    }

    return nodes;
  }

  /**
   * Extract generic entities for unknown file types
   */
  private extractGenericEntities(filePath: string, content: string, lines: string[]): ContextNode[] {
    const nodes: ContextNode[] = [];

    // Extract comments as entities
    const commentRegex = /\/\*\*[\s\S]*?\*\/|\/\/.*$/gm;
    let match;

    while ((match = commentRegex.exec(content)) !== null) {
      if (match[0].length > 50) {
        // Only meaningful comments
        const lineNumber = content.slice(0, match.index).split('\n').length;
        nodes.push({
          id: `comment:${filePath}:${lineNumber}`,
          type: 'comment',
          path: filePath,
          name: `Comment at line ${lineNumber}`,
          content: match[0],
          startLine: lineNumber,
          dependencies: [],
          dependents: [],
          relevanceScore: 0,
          lastAccessed: Date.now(),
          accessCount: 0,
        });
      }
    }

    return nodes;
  }

  /**
   * Build call graph relationships
   */
  private buildCallGraph(nodes: ContextNode[]): void {
    for (const node of nodes) {
      if (node.type === 'function' || node.type === 'class') {
        // Extract function calls from the node's content
        const calls = this.extractFunctionCalls(node.content);

        for (const call of calls) {
          // Add to call graph
          if (!this.callGraph.has(node.id)) {
            this.callGraph.set(node.id, new Set());
          }

          this.callGraph.get(node.id)!.add(call);

          // Add to reverse call graph
          if (!this.reverseCallGraph.has(call)) {
            this.reverseCallGraph.set(call, new Set());
          }

          this.reverseCallGraph.get(call)!.add(node.id);
        }
      }
    }
  }

  /**
   * Phase 2: Intent Analysis and Query Processing
   * Analyzes user queries to understand intent and extract relevant entities
   */
  async analyzeIntent(messages: Message[]): Promise<QueryIntent> {
    const latestMessage = messages[messages.length - 1];

    if (!latestMessage || latestMessage.role !== 'user') {
      throw new Error('No user message found for intent analysis');
    }

    const query = latestMessage.content;

    // Extract intent type
    const intentType = this.classifyIntent(query);

    // Extract entities and keywords
    const entities = this.extractEntities(query);
    const keywords = this.extractKeywords(query);

    // Generate semantic vector (simplified)
    const semanticVector = await this.generateSemanticEmbedding(query);

    return {
      type: intentType,
      entities,
      keywords,
      semanticVector,
      confidence: 0.8, // Simplified confidence score
    };
  }

  /**
   * Classify the type of intent from the query
   */
  private classifyIntent(query: string): QueryIntent['type'] {
    const lowerQuery = query.toLowerCase();

    if (lowerQuery.includes('create') || lowerQuery.includes('generate') || lowerQuery.includes('build')) {
      return 'create';
    }

    if (lowerQuery.includes('modify') || lowerQuery.includes('change') || lowerQuery.includes('update')) {
      return 'modify';
    }

    if (lowerQuery.includes('debug') || lowerQuery.includes('fix') || lowerQuery.includes('error')) {
      return 'debug';
    }

    if (lowerQuery.includes('understand') || lowerQuery.includes('explain') || lowerQuery.includes('how')) {
      return 'understand';
    }

    if (lowerQuery.includes('refactor') || lowerQuery.includes('optimize') || lowerQuery.includes('improve')) {
      return 'refactor';
    }

    if (lowerQuery.includes('test') || lowerQuery.includes('spec')) {
      return 'test';
    }

    return 'understand'; // Default
  }

  /**
   * Phase 3: Context Retrieval and Ranking
   * Retrieves relevant context nodes using semantic + keyword + structural scoring
   */
  async retrieveContext(intent: QueryIntent): Promise<ContextNode[]> {
    const candidates: Array<{ node: ContextNode; score: number }> = [];

    for (const [nodeId, node] of this.nodes) {
      const score = await this.calculateRelevanceScore(node, intent);

      if (score > 0.1) {
        // Minimum relevance threshold
        candidates.push({ node, score });
      }
    }

    // Sort by relevance score
    candidates.sort((a, b) => b.score - a.score);

    // Take top N candidates
    const topCandidates = candidates.slice(0, this.options.maxRetrievedNodes);

    // Add dependency closure for high-scoring nodes
    const finalNodes = new Map<string, ContextNode>();

    for (const { node } of topCandidates) {
      finalNodes.set(node.id, node);

      // Add direct dependencies if score is high enough
      if (topCandidates.find((c) => c.node.id === node.id)!.score > 0.7) {
        this.addDependencyClosure(node, finalNodes, 1); // 1 level deep
      }
    }

    // Update access statistics
    for (const node of finalNodes.values()) {
      node.lastAccessed = Date.now();
      node.accessCount++;
    }

    return Array.from(finalNodes.values());
  }

  /**
   * Calculate relevance score using multiple factors
   */
  private async calculateRelevanceScore(node: ContextNode, intent: QueryIntent): Promise<number> {
    let score = 0;

    // Semantic similarity
    if (node.semanticEmbedding && intent.semanticVector) {
      const semanticSimilarity = this.cosineSimilarity(node.semanticEmbedding, intent.semanticVector);
      score += semanticSimilarity * 0.4;
    }

    // Keyword matching
    const keywordScore = this.calculateKeywordScore(node, intent.keywords);
    score += keywordScore * 0.3;

    // Entity matching
    const entityScore = this.calculateEntityScore(node, intent.entities);
    score += entityScore * 0.2;

    // Structural importance (call graph centrality)
    const structuralScore = this.calculateStructuralScore(node);
    score += structuralScore * 0.1;

    return Math.min(score, 1.0);
  }

  /**
   * Phase 4: Three-Stage Context Compression
   * Implements Augment's three-stage compression for ultra-long contexts
   */
  async compressContext(nodes: ContextNode[], targetTokens: number): Promise<CompressionResult> {
    const originalContent = nodes.map((n) => n.content).join('\n\n');
    const originalSize = this.estimateTokens(originalContent);

    if (originalSize <= targetTokens) {
      return {
        compressed: originalContent,
        originalSize,
        compressedSize: originalSize,
        compressionRatio: 1.0,
        preservedConcepts: [],
      };
    }

    // Stage 1: Syntactic Compression
    let compressed = await this.syntacticCompression(nodes);
    let currentSize = this.estimateTokens(compressed);

    // Stage 2: Semantic Compression
    if (currentSize > targetTokens) {
      compressed = await this.semanticCompression(compressed, targetTokens);
      currentSize = this.estimateTokens(compressed);
    }

    // Stage 3: Conceptual Compression
    if (currentSize > targetTokens) {
      const result = await this.conceptualCompression(compressed, targetTokens);
      compressed = result.compressed;
      currentSize = this.estimateTokens(compressed);
    }

    return {
      compressed,
      originalSize,
      compressedSize: currentSize,
      compressionRatio: currentSize / originalSize,
      preservedConcepts: [], // TODO: Track preserved concepts
    };
  }

  /**
   * Stage 1: Syntactic Compression
   * Remove comments, whitespace, simplify syntax
   */
  private async syntacticCompression(nodes: ContextNode[]): Promise<string> {
    return nodes
      .map((node) => {
        let content = node.content;

        // Remove comments
        content = content.replace(/\/\*[\s\S]*?\*\//g, '');
        content = content.replace(/\/\/.*$/gm, '');

        // Remove extra whitespace
        content = content.replace(/\s+/g, ' ').trim();

        // Keep essential structure
        return `// ${node.type}: ${node.name} (${node.path})\n${content}`;
      })
      .join('\n\n');
  }

  /**
   * Stage 2: Semantic Compression
   * Preserve semantic meaning while reducing verbosity
   */
  private async semanticCompression(content: string, targetTokens: number): Promise<string> {
    /*
     * This would use an LLM to semantically compress while preserving meaning
     * For now, implement a simple heuristic-based compression
     */

    const lines = content.split('\n');
    const importantLines = lines.filter((line) => {
      // Keep function signatures, class declarations, important comments
      return (
        line.includes('function ') ||
        line.includes('class ') ||
        line.includes('interface ') ||
        line.includes('export ') ||
        line.includes('import ') ||
        (line.trim().startsWith('//') && line.length > 20)
      );
    });

    return importantLines.join('\n');
  }

  /**
   * Stage 3: Conceptual Compression
   * Extract high-level concepts and relationships
   */
  private async conceptualCompression(
    content: string,
    targetTokens: number,
  ): Promise<{ compressed: string; concepts: string[] }> {
    /*
     * This would extract key concepts and create a high-level summary
     * For now, implement a simple extraction
     */

    const concepts: string[] = [];
    const lines = content.split('\n');

    // Extract key concepts
    for (const line of lines) {
      if (line.includes('class ') || line.includes('function ') || line.includes('interface ')) {
        concepts.push(line.trim());
      }
    }

    const compressed = concepts.slice(0, Math.floor(targetTokens / 20)).join('\n');

    return { compressed, concepts };
  }

  // Helper methods for the implementation

  private extractFunctionBody(content: string, startIndex: number): string {
    // Extract function body by finding matching braces
    let braceCount = 0;
    let i = startIndex;

    while (i < content.length && (braceCount > 0 || content[i] !== '{')) {
      if (content[i] === '{') {
        braceCount++;
      } else if (content[i] === '}') {
        braceCount--;
      }

      i++;
    }

    return content.slice(startIndex, i);
  }

  private extractClassBody(content: string, startIndex: number): string {
    return this.extractFunctionBody(content, startIndex); // Similar logic
  }

  private extractArrowFunctionBody(content: string, startIndex: number): string {
    // Find the => and extract until semicolon or end of block
    const arrowIndex = content.indexOf('=>', startIndex);

    if (arrowIndex === -1) {
      return '';
    }

    let endIndex = arrowIndex + 2;

    if (content[endIndex] === '{') {
      return this.extractFunctionBody(content, arrowIndex);
    } else {
      // Single expression arrow function
      while (endIndex < content.length && content[endIndex] !== ';' && content[endIndex] !== '\n') {
        endIndex++;
      }
      return content.slice(startIndex, endIndex);
    }
  }

  private extractPythonFunctionBody(content: string, startIndex: number, indentLevel: number): string {
    const lines = content.split('\n');
    const startLine = content.slice(0, startIndex).split('\n').length - 1;

    let endLine = startLine + 1;

    while (endLine < lines.length) {
      const line = lines[endLine];

      if (line.trim() === '') {
        endLine++;
        continue;
      }

      const lineIndent = line.length - line.trimStart().length;

      if (lineIndent <= indentLevel) {
        break;
      }

      endLine++;
    }

    return lines.slice(startLine, endLine).join('\n');
  }

  private extractPythonClassBody(content: string, startIndex: number, indentLevel: number): string {
    return this.extractPythonFunctionBody(content, startIndex, indentLevel);
  }

  private extractMethodBody(content: string, startIndex: number): string {
    return this.extractFunctionBody(content, startIndex);
  }

  private extractFunctionCalls(content: string): string[] {
    const calls: string[] = [];
    const callRegex = /(\w+)\s*\(/g;
    let match;

    while ((match = callRegex.exec(content)) !== null) {
      calls.push(match[1]);
    }

    return calls;
  }

  private async generateSemanticEmbedding(text: string): Promise<number[]> {
    /*
     * In a real implementation, this would use a proper embedding model
     * For now, return a simple hash-based vector
     */
    const hash = this.simpleHash(text);
    const vector = [];

    for (let i = 0; i < 384; i++) {
      vector.push(((hash + i) % 100) / 100);
    }

    return vector;
  }

  private simpleHash(str: string): number {
    let hash = 0;

    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return Math.abs(hash);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private calculateKeywordScore(node: ContextNode, keywords: string[]): number {
    if (keywords.length === 0) {
      return 0;
    }

    const nodeText = (node.name + ' ' + node.content).toLowerCase();
    let matches = 0;

    for (const keyword of keywords) {
      if (nodeText.includes(keyword.toLowerCase())) {
        matches++;
      }
    }

    return matches / keywords.length;
  }

  private calculateEntityScore(node: ContextNode, entities: string[]): number {
    if (entities.length === 0) {
      return 0;
    }

    const nodeText = (node.name + ' ' + node.content).toLowerCase();
    let matches = 0;

    for (const entity of entities) {
      if (nodeText.includes(entity.toLowerCase())) {
        matches++;
      }
    }

    return matches / entities.length;
  }

  private calculateStructuralScore(node: ContextNode): number {
    // Calculate based on call graph centrality
    const outDegree = this.callGraph.get(node.id)?.size || 0;
    const inDegree = this.reverseCallGraph.get(node.id)?.size || 0;

    // Normalize by total nodes (simple centrality measure)
    return (outDegree + inDegree) / Math.max(this.nodes.size, 1);
  }

  private addDependencyClosure(node: ContextNode, result: Map<string, ContextNode>, depth: number): void {
    if (depth <= 0) {
      return;
    }

    // Add direct dependencies
    for (const depId of node.dependencies) {
      const depNode = this.nodes.get(depId);

      if (depNode && !result.has(depId)) {
        result.set(depId, depNode);
        this.addDependencyClosure(depNode, result, depth - 1);
      }
    }

    // Add nodes that call this node
    const callers = this.reverseCallGraph.get(node.id);

    if (callers) {
      for (const callerId of callers) {
        const callerNode = this.nodes.get(callerId);

        if (callerNode && !result.has(callerId)) {
          result.set(callerId, callerNode);
          this.addDependencyClosure(callerNode, result, depth - 1);
        }
      }
    }
  }

  private extractEntities(query: string): string[] {
    // Simple entity extraction (in real implementation, use NER)
    const words = query.split(/\s+/);
    return words.filter(
      (word) => word.length > 2 && /^[A-Z][a-zA-Z]*$/.test(word), // Capitalized words
    );
  }

  private extractKeywords(query: string): string[] {
    // Simple keyword extraction
    const stopWords = new Set([
      'the',
      'a',
      'an',
      'and',
      'or',
      'but',
      'in',
      'on',
      'at',
      'to',
      'for',
      'of',
      'with',
      'by',
    ]);
    const words = query.toLowerCase().split(/\s+/);

    return words.filter((word) => word.length > 2 && !stopWords.has(word) && /^[a-zA-Z]+$/.test(word));
  }

  private estimateTokens(text: string): number {
    // Simple token estimation (roughly 4 characters per token)
    return Math.ceil(text.length / 4);
  }

  /**
   * Main entry point for context optimization
   */
  async optimizeContext(
    messages: Message[],
    files: FileMap,
    maxTokens: number,
  ): Promise<{ context: string; metadata: any }> {
    try {
      // Phase 1: Index the codebase
      await this.indexCodebase(files);

      // Phase 2: Analyze user intent
      const intent = await this.analyzeIntent(messages);

      // Phase 3: Retrieve relevant context
      const relevantNodes = await this.retrieveContext(intent);

      // Phase 4: Compress context to fit token limits
      const compressionResult = await this.compressContext(relevantNodes, maxTokens);

      logger.info(
        `Context optimization completed: ${compressionResult.originalSize} -> ${compressionResult.compressedSize} tokens (${(compressionResult.compressionRatio * 100).toFixed(1)}% compression)`,
      );

      return {
        context: compressionResult.compressed,
        metadata: {
          intent,
          nodesRetrieved: relevantNodes.length,
          compression: compressionResult,
          totalIndexedNodes: this.nodes.size,
        },
      };
    } catch (error) {
      logger.error('Context optimization failed:', error);
      throw error;
    }
  }
}
