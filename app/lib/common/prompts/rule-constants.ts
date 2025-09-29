/**
 * Reusable rule constants and schemas for prompt generation
 * This file contains deduplicated rules that appear across multiple prompt sections
 */

export type RuleSet = {
  minimal: string;
  standard: string;
  detailed: string;
};

export type RuleCategory =
  | 'webcontainer_constraints'
  | 'technology_preferences'
  | 'project_context_detection'
  | 'artifact_creation'
  | 'dependency_management'
  | 'database_safety'
  | 'code_quality'
  | 'security_guidelines'
  | 'performance_guidelines';

/**
 * Core rule constants that appear frequently across prompts
 */
export const CORE_RULES: Record<RuleCategory, RuleSet> = {
  webcontainer_constraints: {
    minimal: 'WebContainer: Browser-based Node.js runtime. JavaScript/WebAssembly only. No native binaries.',
    standard:
      'WebContainer environment: Browser-based Node.js runtime emulating Linux. JavaScript and WebAssembly only. Python limited to standard library. No native binaries or compilers.',
    detailed: `<system_constraints>
  You operate in WebContainer, an in-browser Node.js runtime that emulates a Linux system:
    - Runs in browser, not full Linux system or cloud VM
    - Shell emulating zsh
    - Cannot run native binaries (only JS, WebAssembly)
    - Python limited to standard library (no pip, no third-party libraries)
    - No C/C++/Rust compiler available
    - Git not available
    - Available commands: cat, chmod, cp, echo, hostname, kill, ln, ls, mkdir, mv, ps, pwd, rm, rmdir, xxd, alias, cd, clear, curl, env, false, getconf, head, sort, tail, touch, true, uptime, which, code, jq, loadenv, node, python, python3, wasm, xdg-open, command, exit, export, source
</system_constraints>`,
  },

  technology_preferences: {
    minimal: 'Use: Vite (web servers), Node.js scripts, Supabase (databases), Pexels (images, URLs only).',
    standard: `<tech_prefs>
  - Use Vite for web servers
  - Prefer Node.js scripts over shell scripts
  - Use Supabase for databases (or JS-only alternatives)
  - Use Pexels stock photos (URLs only, never download)
</tech_prefs>`,
    detailed: `<technology_preferences>
  - Use Vite for web servers
  - ALWAYS choose Node.js scripts over shell scripts
  - Use Supabase for databases by default. If user specifies otherwise, only JavaScript-implemented databases/npm packages (e.g., libsql, sqlite) will work
  - Bolt ALWAYS uses stock photos from Pexels (valid URLs only). NEVER downloads images, only links to them.
</technology_preferences>`,
  },

  project_context_detection: {
    minimal: "Check existing project first. Add features to existing projects, don't recreate.",
    standard:
      "CRITICAL: Analyze existing project structure before changes. For existing projects: ADD FEATURES, don't recreate entire project.",
    detailed: `<project_context_awareness>
  CRITICAL PROJECT CONTEXT DETECTION:
    - ALWAYS analyze existing project structure BEFORE making changes
    - If package.json, app/ directory, or framework files exist, you are WORKING WITH AN EXISTING PROJECT
    - For existing projects: ADD FEATURES, don't recreate the entire project
    - Only create new projects when explicitly requested or when no project files exist
    - Respect existing architecture, dependencies, and patterns
    - DETECT if you're working with an existing project vs creating a new one
</project_context_awareness>`,
  },

  artifact_creation: {
    minimal: 'Create one artifact per response. Include files and commands. Working directory: {cwd}',
    standard: `<artifact_rules>
  - Maximum one <boltArtifact> per response
  - Include files to create and shell commands
  - Working directory: {cwd}
  - Structure: <boltArtifact id="kebab-case" title="Title"><boltAction>...</boltAction></boltArtifact>
  - Action types: shell, file, start
</artifact_rules>`,
    detailed: `<artifact_instructions>
  CRITICAL RULES - MANDATORY:
  1. Maximum one <boltArtifact> per response
  2. Current working directory: {cwd}
  3. ALWAYS use latest file modifications, NEVER fake placeholder code
  4. Structure: <boltArtifact id="kebab-case" title="Title"><boltAction>...</boltAction></boltArtifact>

  Action Types:
    - shell: Running commands (use --yes for npx/npm create, && for sequences, NEVER re-run dev servers)
    - start: Starting project (use ONLY for project startup, LAST action)
    - file: Creating/updating files (add filePath attribute)

  File Action Rules:
    - Only include new/modified files
    - NEVER use diffs for new files or SQL migrations
    - FORBIDDEN: Binary files, base64 assets

  Action Order:
    - Create files BEFORE shell commands that depend on them
    - Update package.json FIRST, then install dependencies
    - Configuration files before initialization commands
    - Start command LAST
</artifact_instructions>`,
  },

  dependency_management: {
    minimal: 'Update package.json first. Use latest stable versions. Single install command.',
    standard: `<dependency_rules>
  - Update package.json with ALL dependencies upfront
  - Use latest stable versions of packages
  - Run single install command after updating package.json
  - Include dev dependencies for tooling
</dependency_rules>`,
    detailed: `<dependency_management>
  Dependencies:
    - Update package.json with ALL dependencies upfront
    - ALWAYS use latest stable versions of packages
    - Check for and update outdated dependencies in existing projects
    - Run single install command after updating package.json
    - Avoid individual package installations
    - Include dev dependencies for tooling (ESLint, Prettier, TypeScript, etc.)
    - Use semantic versioning and avoid deprecated packages
    - Verify package compatibility and security
</dependency_management>`,
  },

  database_safety: {
    minimal: 'FORBIDDEN: DROP, DELETE, destructive operations. Use migrations. Enable RLS.',
    standard: `<db_safety>
  DATA PRESERVATION - HIGHEST PRIORITY:
  - FORBIDDEN: Destructive operations (DROP, DELETE, TRUNCATE)
  - FORBIDDEN: Transaction control (BEGIN, COMMIT, ROLLBACK)
  - Create migration files for schema changes
  - ALWAYS enable RLS for new tables
</db_safety>`,
    detailed: `<database_safety_rules>
  DATA PRESERVATION REQUIREMENTS:
    - DATA INTEGRITY IS HIGHEST PRIORITY - users must NEVER lose data
    - FORBIDDEN: Destructive operations (DROP, DELETE) that could cause data loss
    - FORBIDDEN: Transaction control (BEGIN, COMMIT, ROLLBACK, END)
      Note: DO $$ BEGIN ... END $$ blocks (PL/pgSQL) are allowed

  SQL Migrations - CRITICAL: For EVERY database change, provide TWO actions:
    1. Migration File: <boltAction type="supabase" operation="migration" filePath="/supabase/migrations/name.sql">
    2. Query Execution: <boltAction type="supabase" operation="query" projectId="\${projectId}">

  Migration Rules:
    - NEVER use diffs, ALWAYS provide COMPLETE file content
    - Create new migration file for each change in /home/project/supabase/migrations
    - NEVER update existing migration files
    - Descriptive names without number prefix (e.g., create_users.sql)
    - ALWAYS enable RLS: alter table users enable row level security;
    - Add appropriate RLS policies for CRUD operations
    - Use default values: DEFAULT false/true, DEFAULT 0, DEFAULT '', DEFAULT now()
    - Start with markdown summary in multi-line comment explaining changes
    - Use IF EXISTS/IF NOT EXISTS for safe operations
</database_safety_rules>`,
  },

  code_quality: {
    minimal: 'Write clean code. Use TypeScript types. Add error handling. Follow naming conventions.',
    standard: `<code_quality>
  - Write clean, readable, well-structured code
  - Use consistent naming conventions (camelCase, PascalCase)
  - Add TypeScript types and comprehensive error handling
  - Use modern JavaScript/TypeScript features
  - Follow Single Responsibility Principle
  - Use meaningful variable names and constants
</code_quality>`,
    detailed: `<code_quality_standards>
  CRITICAL Code Quality Requirements:
  - Write clean, readable, and well-structured code that follows modern best practices
  - Use consistent naming conventions (camelCase for variables/functions, PascalCase for components/classes)
  - Implement proper error handling with try-catch blocks and meaningful error messages
  - Add TypeScript types for all functions, props, and data structures where applicable
  - Use modern JavaScript/TypeScript features (arrow functions, destructuring, async/await, optional chaining)
  - Write self-documenting code with clear variable and function names
  - Add JSDoc comments for complex functions and public APIs
  - Follow the Single Responsibility Principle (SRP) - one function, one purpose
  - Avoid deep nesting and complex conditional logic
  - Use early returns to reduce nesting
  - Implement proper validation for user inputs and API responses
  - Use meaningful variable names that describe the data they contain
  - Avoid magic numbers and strings - use named constants
  - Prefer composition over inheritance
  - Write code that is easy to test and maintain
</code_quality_standards>`,
  },

  security_guidelines: {
    minimal: 'Never expose secrets. Use environment variables. Enable RLS for databases.',
    standard: `<security_rules>
  - Never expose or log secrets and keys
  - Use environment variables for sensitive data
  - Enable Row Level Security (RLS) for database tables
  - Validate all user inputs
  - Follow security best practices
</security_rules>`,
    detailed: `<security_guidelines>
  CRITICAL Security Requirements:
  - NEVER introduce code that exposes or logs secrets and keys
  - NEVER commit secrets or keys to the repository
  - Use environment variables for all sensitive configuration
  - Enable Row Level Security (RLS) for every new database table
  - Create policies based on user authentication
  - Implement proper validation for user inputs and API responses
  - Use HTTPS for all external API calls
  - Sanitize user inputs to prevent injection attacks
  - Follow OWASP security guidelines
  - Use proper authentication and authorization patterns
  - Implement rate limiting where appropriate
</security_guidelines>`,
  },

  performance_guidelines: {
    minimal: 'Optimize for performance. Use lazy loading. Minimize bundle size.',
    standard: `<performance_rules>
  - Optimize for performance and memory usage
  - Use lazy loading for large components and routes
  - Minimize bundle size with code splitting
  - Use memo/useCallback for expensive operations
  - Optimize images and assets
</performance_rules>`,
    detailed: `<performance_guidelines>
  CRITICAL Performance Requirements:
  - Optimize for performance and memory usage
  - Use lazy loading for large components, routes, and data
  - Implement code splitting to minimize initial bundle size
  - Use React.memo, useMemo, and useCallback for expensive operations
  - Optimize images with proper formats and lazy loading
  - Use appropriate data structures and algorithms
  - Implement pagination for large datasets
  - Use FlatList for large lists in React Native
  - Minimize re-renders through proper state management
  - Use Web Workers for heavy computations
  - Implement proper caching strategies
  - Monitor and optimize Core Web Vitals
</performance_guidelines>`,
  },
};

/**
 * Shorthand rule schemas for ultra-compressed prompts
 */
export const SHORTHAND_SCHEMAS = {
  forbidden_ops: '<forbidden: DROP,DELETE,TRANSACTION>',
  required_order: '<order: files→deps→start>',
  safety_first: '<safety: RLS,validation,env-vars>',
  modern_code: '<code: TS,error-handling,SRP>',
  webcontainer: '<env: browser-nodejs,js-only>',
  tech_stack: '<stack: Vite,Supabase,Pexels>',
} as const;

/**
 * Context-specific rule combinations
 */
export const RULE_COMBINATIONS = {
  bug_fix: {
    required: ['project_context_detection', 'artifact_creation'],
    optional: ['code_quality', 'security_guidelines'],
    forbidden: ['dependency_management'], // Don't change deps for bug fixes
  },

  new_project: {
    required: ['artifact_creation', 'dependency_management', 'code_quality', 'security_guidelines'],
    optional: ['performance_guidelines'],
    forbidden: [],
  },

  database_ops: {
    required: ['database_safety', 'security_guidelines', 'artifact_creation'],
    optional: ['code_quality'],
    forbidden: [],
  },

  design_ui: {
    required: ['artifact_creation', 'code_quality'],
    optional: ['performance_guidelines'],
    forbidden: ['database_safety'],
  },

  explain_code: {
    required: [],
    optional: ['code_quality'],
    forbidden: ['artifact_creation', 'dependency_management'],
  },
} as const;

/**
 * Gets rule content based on verbosity level
 */
export function getRule(category: RuleCategory, verbosity: 'minimal' | 'standard' | 'detailed' = 'standard'): string {
  return CORE_RULES[category][verbosity];
}

/**
 * Gets multiple rules combined
 */
export function getCombinedRules(
  categories: RuleCategory[],
  verbosity: 'minimal' | 'standard' | 'detailed' = 'standard',
  options: { cwd?: string } = {},
): string {
  return categories
    .map((category) => {
      let rule = getRule(category, verbosity);

      // Replace placeholders
      if (options.cwd) {
        rule = rule.replace('{cwd}', options.cwd);
      }

      return rule;
    })
    .filter((rule) => rule.trim() !== '')
    .join('\n\n');
}

/**
 * Gets shorthand schema string
 */
export function getShorthandRules(schemas: (keyof typeof SHORTHAND_SCHEMAS)[]): string {
  return schemas.map((schema) => SHORTHAND_SCHEMAS[schema]).join(' ');
}

/**
 * Gets context-appropriate rules for an intent
 */
export function getRulesForIntent(
  intentCategory: keyof typeof RULE_COMBINATIONS,
  verbosity: 'minimal' | 'standard' | 'detailed' = 'standard',
  options: { cwd?: string } = {},
): {
  required: string;
  optional: string;
} {
  const combination = RULE_COMBINATIONS[intentCategory];

  return {
    required: getCombinedRules([...combination.required], verbosity, options),
    optional: getCombinedRules([...combination.optional], verbosity, options),
  };
}

/**
 * Technology-specific constants
 */
/**
 * Validation patterns for common rules
 */
export const VALIDATION_PATTERNS = {
  no_destructive_sql: /\b(DROP|DELETE|TRUNCATE|ALTER\s+TABLE\s+.*\s+DROP)\b/i,
  has_rls_enabled: /ALTER\s+TABLE\s+.*\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/i,
  proper_env_vars: /VITE_SUPABASE_(URL|ANON_KEY)/,
  safe_migrations: /IF\s+(NOT\s+)?EXISTS/i,
} as const;

/**
 * Helper function to validate generated content against rules
 */
export function validateAgainstRules(
  content: string,
  ruleCategories: RuleCategory[],
): {
  valid: boolean;
  violations: string[];
} {
  const violations: string[] = [];

  if (ruleCategories.includes('database_safety')) {
    if (VALIDATION_PATTERNS.no_destructive_sql.test(content)) {
      violations.push('Contains destructive SQL operations');
    }

    if (content.includes('CREATE TABLE') && !VALIDATION_PATTERNS.has_rls_enabled.test(content)) {
      violations.push('Missing RLS enablement for new tables');
    }
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}
