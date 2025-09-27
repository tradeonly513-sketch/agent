import type { ModelInfo } from '~/lib/modules/llm/types';

const NON_CODE_KEYWORDS = [
  'embedding',
  'embed',
  'audio',
  'voice',
  'speech',
  'tts',
  'vision',
  'video',
  'image',
  'ocr',
  'rerank',
  'reranker',
  'moderation',
  'moderate',
  'filter',
  'realtime',
];

const DEPRECATED_MODEL_PATTERNS = [
  /^gpt-3\.5/, // OpenAI GPT-3.5 family
  /^gpt-4-0?3/,
  /^gpt-4-0613/,
  /^gpt-4-32k/,
  /^gpt-4-turbo-2024/, // Older GPT-4 Turbo snapshots
  /^text-davinci/, // Legacy OpenAI text models
  /^code-davinci/, // Legacy OpenAI code models
  /^claude-1/,
  /^claude-2/,
  /^claude-instant/, // Legacy Claude
  /^gemini-(1\.0|1\.5-pro-vision)/,
  /^codey/, // Legacy Google Codey models
  /^palm/,
  /^bison/, // Legacy Google PaLM/Bison
  /^command-light/,
  /^command-nightly/,
  /^command-r-0[1-7]/, // Older Cohere snapshots
  /sonar-small/,
  /llama-3\.1-sonar/, // Legacy Perplexity Sonar
];

const PROVIDER_KEYWORDS: Record<string, string[]> = {
  OpenAI: ['gpt-4', 'gpt-4o', 'gpt-4.1', 'gpt-5', 'gpt-5o', 'gpt-5.1', 'gpt-5-mini', 'o1', 'o2', 'o3', 'o4'],
  Anthropic: ['claude'],
  Google: ['gemini', 'codegemma'],
  Github: [
    'gpt-4',
    'gpt-4o',
    'gpt-4.1',
    'claude',
    'deepseek',
    'codestral',
    'llama',
    'mixtral',
    'mistral',
    'gemma',
    'qwen',
    'coder',
    'code',
  ],
  Groq: ['llama', 'mixtral', 'mistral', 'gemma', 'phi', 'deepseek', 'qwen'],
  Mistral: ['codestral', 'mistral', 'mixtral', 'ministral'],
  Cloudflare: ['gpt-oss', 'llama', 'mistral', 'gemma', 'qwen', 'phi', 'sqlcoder'],
  Cerebras: ['llama', 'mistral', 'mixtral', 'qwen', 'phi', 'granite'],
  Together: ['code', 'coder', 'llama', 'mixtral', 'mistral', 'gemma', 'qwen', 'phi', 'deepseek'],
  OpenRouter: ['code', 'coder', 'llama', 'mixtral', 'mistral', 'gemma', 'qwen', 'phi', 'deepseek', 'claude', 'gpt-4'],
  Perplexity: ['sonar', 'code', 'coder'],
  Deepseek: ['deepseek', 'r1', 'v3', 'coder', 'chat'],
  XAI: ['grok'],
  Hyperbolic: ['qwen', 'deepseek', 'coder', 'glm', 'qwq'],
  ZAI: ['glm'],
  LMStudio: ['code', 'coder', 'llama', 'mixtral', 'mistral', 'gemma', 'qwen', 'phi', 'deepseek'],
  Ollama: ['code', 'coder', 'llama', 'mixtral', 'mistral', 'gemma', 'qwen', 'phi', 'deepseek'],
  OpenAILike: ['code', 'coder', 'llama', 'mixtral', 'mistral', 'gemma', 'qwen', 'phi', 'deepseek', 'gpt-4', 'claude'],
  HuggingFace: ['code', 'coder', 'llama', 'mixtral', 'mistral', 'gemma', 'qwen', 'phi', 'deepseek', 'yi', 'hermes'],
  Moonshot: ['moonshot', 'kimi'],
  Cohere: ['command', 'aya'],
  AmazonBedrock: ['claude', 'nova', 'mistral'],
};

const DEFAULT_KEYWORDS = [
  'code',
  'coder',
  'codellama',
  'codestral',
  'codegemma',
  'codeqwen',
  'codex',
  'deepseek',
  'dev',
  'program',
  'llama',
  'mixtral',
  'mistral',
  'gemma',
  'qwen',
  'phi',
  'hermes',
  'starcoder',
  'granite',
  'command',
  'glm',
  'grok',
  'yi',
  'moonshot',
  'kimi',
  'sonar',
  'sonnet',
  'haiku',
  'opus',
  'gemini',
  'claude',
  'gpt-4',
  'gpt-5',
  'gpt-5o',
  'gpt-5.1',
  'gpt-5-mini',
  'o1',
  'o2',
  'o3',
  'o4',
  'reasoning',
  'deepseek-r1',
];

function isDeprecatedModel(modelId: string): boolean {
  const id = modelId.toLowerCase();
  return DEPRECATED_MODEL_PATTERNS.some((pattern) => pattern.test(id));
}

function containsKeyword(modelId: string, keywords: string[]): boolean {
  const id = modelId.toLowerCase();
  return keywords.some((keyword) => id.includes(keyword.toLowerCase()));
}

function hasNonCodeKeyword(modelId: string): boolean {
  const id = modelId.toLowerCase();
  return NON_CODE_KEYWORDS.some((keyword) => id.includes(keyword));
}

export function isLikelyCodeModel(provider: string, modelId: string): boolean {
  if (!modelId) {
    return false;
  }

  if (hasNonCodeKeyword(modelId)) {
    return false;
  }

  if (isDeprecatedModel(modelId)) {
    return false;
  }

  const providerKeywords = PROVIDER_KEYWORDS[provider] || [];

  if (providerKeywords.length > 0 && containsKeyword(modelId, providerKeywords)) {
    return true;
  }

  return containsKeyword(modelId, DEFAULT_KEYWORDS);
}

export function filterCodeModelInfos(provider: string, models: ModelInfo[]): ModelInfo[] {
  const seen = new Set<string>();
  const filtered: ModelInfo[] = [];

  for (const model of models) {
    if (!model?.name) {
      continue;
    }

    const key = model.name.toLowerCase();

    if (seen.has(key)) {
      continue;
    }

    if (!isLikelyCodeModel(provider, model.name)) {
      continue;
    }

    seen.add(key);
    filtered.push(model);
  }

  return filtered;
}
