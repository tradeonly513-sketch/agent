import ruleData from './schemas/rule-data.json';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('SchemaLoader');

export type VerbosityLevel = 'minimal' | 'standard' | 'detailed';
export type RuleCategory = keyof typeof ruleData.rules;
export type IntentCategory = keyof typeof ruleData.intentRuleMappings;
export type ProviderCategory = keyof typeof ruleData.providerOptimizations;

/**
 * Interface for the loaded rule data
 */
export interface RuleData {
  rules: Record<
    string,
    {
      minimal: string;
      standard: string;
      detailed: string;
    }
  >;
  shorthandSchemas: Record<string, string>;
  intentRuleMappings: Record<
    string,
    {
      required: string[];
      optional: string[];
      forbidden: string[];
    }
  >;
  providerOptimizations: Record<
    string,
    {
      tokenReduction: number;
      preferredVerbosity: VerbosityLevel;
      prioritySections: string[];
      excludedSections: string[];
      simplifyLanguage: boolean;
      enhanceCodeGuidelines: boolean;
    }
  >;
  contextualRules: Record<
    string,
    Record<
      string,
      {
        minimal: string;
        standard: string;
        detailed: string;
      }
    >
  >;
  validationPatterns: Record<
    string,
    {
      pattern: string;
      flags?: string;
      description: string;
      severity: 'error' | 'warning' | 'info';
    }
  >;
  tokenEstimates: Record<
    string,
    {
      minimal: number;
      standard: number;
      detailed: number;
    }
  >;
}

/**
 * Cached rule data to avoid repeated JSON parsing
 */
let cachedRuleData: RuleData | null = null;

/**
 * Loads and validates rule data from JSON schemas
 */
export function loadRuleData(): RuleData {
  if (cachedRuleData) {
    return cachedRuleData;
  }

  try {
    // Validate the loaded data has required properties
    if (!ruleData.rules || !ruleData.shorthandSchemas || !ruleData.intentRuleMappings) {
      throw new Error('Invalid rule data structure: missing required properties');
    }

    cachedRuleData = ruleData as RuleData;
    logger.info('Rule data loaded successfully', {
      rulesCount: Object.keys(ruleData.rules).length,
      intentMappingsCount: Object.keys(ruleData.intentRuleMappings).length,
      providerOptimizationsCount: Object.keys(ruleData.providerOptimizations).length,
    });

    return cachedRuleData;
  } catch (error) {
    logger.error('Failed to load rule data', error);
    throw new Error('Failed to load rule data from schemas');
  }
}

/**
 * Gets a specific rule by category and verbosity level
 */
export function getRule(
  category: RuleCategory,
  verbosity: VerbosityLevel = 'standard',
  placeholders: Record<string, string> = {},
): string {
  const data = loadRuleData();
  const rule = data.rules[category];

  if (!rule) {
    logger.warn(`Rule category '${category}' not found`);
    return '';
  }

  let ruleText = rule[verbosity];

  // Replace placeholders
  for (const [placeholder, value] of Object.entries(placeholders)) {
    ruleText = ruleText.replace(new RegExp(`{${placeholder}}`, 'g'), value);
  }

  return ruleText;
}

/**
 * Gets multiple rules combined
 */
export function getCombinedRules(
  categories: RuleCategory[],
  verbosity: VerbosityLevel = 'standard',
  placeholders: Record<string, string> = {},
): string {
  return categories
    .map((category) => getRule(category, verbosity, placeholders))
    .filter((rule) => rule.trim() !== '')
    .join('\n\n');
}

/**
 * Gets shorthand schema strings
 */
export function getShorthandRules(schemas: string[]): string {
  const data = loadRuleData();
  return schemas
    .map((schema) => data.shorthandSchemas[schema])
    .filter(Boolean)
    .join(' ');
}

/**
 * Gets rule mapping for a specific intent
 */
export function getRulesForIntent(
  intentCategory: IntentCategory,
  verbosity: VerbosityLevel = 'standard',
  placeholders: Record<string, string> = {},
): {
  required: string;
  optional: string;
  forbidden: string[];
} {
  const data = loadRuleData();
  const mapping = data.intentRuleMappings[intentCategory];

  if (!mapping) {
    logger.warn(`Intent category '${intentCategory}' not found`);
    return { required: '', optional: '', forbidden: [] };
  }

  return {
    required: getCombinedRules(mapping.required as RuleCategory[], verbosity, placeholders),
    optional: getCombinedRules(mapping.optional as RuleCategory[], verbosity, placeholders),
    forbidden: mapping.forbidden,
  };
}

/**
 * Gets provider-specific optimization settings
 */
export function getProviderOptimization(providerCategory: ProviderCategory) {
  const data = loadRuleData();
  const optimization = data.providerOptimizations[providerCategory];

  if (!optimization) {
    logger.warn(`Provider category '${providerCategory}' not found`);
    return data.providerOptimizations.standard;
  }

  return optimization;
}

/**
 * Gets contextual rules for specific scenarios
 */
export function getContextualRule(
  context: string,
  subContext: string,
  verbosity: VerbosityLevel = 'standard',
  placeholders: Record<string, string> = {},
): string {
  const data = loadRuleData();
  const contextRules = data.contextualRules[context];

  if (!contextRules || !contextRules[subContext]) {
    logger.warn(`Contextual rule '${context}.${subContext}' not found`);
    return '';
  }

  let ruleText = contextRules[subContext][verbosity];

  // Replace placeholders
  for (const [placeholder, value] of Object.entries(placeholders)) {
    ruleText = ruleText.replace(new RegExp(`{${placeholder}}`, 'g'), value);
  }

  return ruleText;
}

/**
 * Validates content against rule patterns
 */
export function validateContent(
  content: string,
  ruleCategories: RuleCategory[],
): {
  valid: boolean;
  violations: Array<{
    rule: string;
    severity: 'error' | 'warning' | 'info';
    description: string;
  }>;
} {
  const data = loadRuleData();
  const violations: Array<{
    rule: string;
    severity: 'error' | 'warning' | 'info';
    description: string;
  }> = [];

  // Check patterns relevant to the rule categories
  for (const category of ruleCategories) {
    if (category === 'database_safety') {
      // Check for destructive SQL
      const destructivePattern = data.validationPatterns.no_destructive_sql;

      if (destructivePattern) {
        const regex = new RegExp(destructivePattern.pattern, destructivePattern.flags);

        if (regex.test(content)) {
          violations.push({
            rule: 'no_destructive_sql',
            severity: destructivePattern.severity,
            description: destructivePattern.description,
          });
        }
      }

      // Check for RLS enablement if creating tables
      if (content.includes('CREATE TABLE')) {
        const rlsPattern = data.validationPatterns.has_rls_enabled;

        if (rlsPattern) {
          const regex = new RegExp(rlsPattern.pattern, rlsPattern.flags);

          if (!regex.test(content)) {
            violations.push({
              rule: 'has_rls_enabled',
              severity: rlsPattern.severity,
              description: rlsPattern.description,
            });
          }
        }
      }
    }
  }

  return {
    valid: violations.filter((v) => v.severity === 'error').length === 0,
    violations,
  };
}

/**
 * Estimates token count for rule combinations
 */
export function estimateTokens(categories: RuleCategory[], verbosity: VerbosityLevel = 'standard'): number {
  const data = loadRuleData();
  return categories.reduce((total, category) => {
    const estimate = data.tokenEstimates[category];
    return total + (estimate ? estimate[verbosity] : 0);
  }, 0);
}

/**
 * Gets all available rule categories
 */
export function getAvailableRuleCategories(): RuleCategory[] {
  const data = loadRuleData();
  return Object.keys(data.rules) as RuleCategory[];
}

/**
 * Gets all available intent categories
 */
export function getAvailableIntentCategories(): IntentCategory[] {
  const data = loadRuleData();
  return Object.keys(data.intentRuleMappings) as IntentCategory[];
}

/**
 * Gets all available provider categories
 */
export function getAvailableProviderCategories(): ProviderCategory[] {
  const data = loadRuleData();
  return Object.keys(data.providerOptimizations) as ProviderCategory[];
}

/**
 * Refreshes the cached rule data (useful for development/testing)
 */
export function refreshRuleData(): void {
  cachedRuleData = null;
  logger.info('Rule data cache cleared');
}

/**
 * Gets rule data statistics for debugging
 */
export function getRuleDataStats(): {
  totalRules: number;
  totalIntentMappings: number;
  totalProviderOptimizations: number;
  totalValidationPatterns: number;
  averageTokensPerRule: Record<VerbosityLevel, number>;
} {
  const data = loadRuleData();

  const averageTokensPerRule: Record<VerbosityLevel, number> = {
    minimal: 0,
    standard: 0,
    detailed: 0,
  };

  // Calculate average tokens per verbosity level
  const categories = Object.keys(data.tokenEstimates);

  for (const verbosity of ['minimal', 'standard', 'detailed'] as VerbosityLevel[]) {
    const totalTokens = categories.reduce((sum, category) => {
      return sum + (data.tokenEstimates[category]?.[verbosity] || 0);
    }, 0);
    averageTokensPerRule[verbosity] = Math.round(totalTokens / categories.length);
  }

  return {
    totalRules: Object.keys(data.rules).length,
    totalIntentMappings: Object.keys(data.intentRuleMappings).length,
    totalProviderOptimizations: Object.keys(data.providerOptimizations).length,
    totalValidationPatterns: Object.keys(data.validationPatterns).length,
    averageTokensPerRule,
  };
}
