import type { VerbosityLevel } from './mode-specific-builders';
import {
  getSupabaseWorkflowInstructions,
  analyzeSupabaseContext,
  normalizeSupabaseConnectionState,
  type LegacySupabaseConnectionState,
} from './supabase-workflow-rules';
import type { SupabaseConnectionState as StoreConnectionState } from '~/lib/stores/supabase';

export type SupabaseConnectionState = LegacySupabaseConnectionState | StoreConnectionState;

/**
 * Generates compressed Supabase instructions based on connection state and verbosity
 * Enhanced with workflow-aware guidance
 */
export function getCompressedSupabaseInstructions(
  connectionState: SupabaseConnectionState | StoreConnectionState,
  verbosity: VerbosityLevel = 'standard',
): string {
  const storeConnectionState = normalizeSupabaseConnectionState(connectionState as any);
  const workflowContext = analyzeSupabaseContext(storeConnectionState);
  const workflowInstructions = getSupabaseWorkflowInstructions(workflowContext, verbosity);

  // Return workflow instructions (they handle all states)
  return workflowInstructions;
}

/**
 * Context-specific Supabase instructions for different operations
 */
export function getContextualSupabaseInstructions(
  connectionState: SupabaseConnectionState,
  context: 'schema' | 'auth' | 'queries' | 'migration' | 'general',
  verbosity: VerbosityLevel = 'standard',
): string {
  const normalized = normalizeSupabaseConnectionState(connectionState as any);
  const baseInstructions = getCompressedSupabaseInstructions(connectionState, verbosity);

  if (!normalized.isConnected || !normalized.selectedProjectId) {
    return baseInstructions;
  }

  // Add context-specific additions
  const contextAdditions = getContextSpecificAdditions(context, verbosity);

  return `${baseInstructions}\n\n${contextAdditions}`;
}

/**
 * Context-specific additions for different database operations
 */
function getContextSpecificAdditions(
  context: 'schema' | 'auth' | 'queries' | 'migration' | 'general',
  verbosity: VerbosityLevel,
): string {
  switch (context) {
    case 'schema':
      return verbosity === 'minimal'
        ? 'Schema: Create migrations, enable RLS, add policies.'
        : `Schema Operations:
- Create migration file for each schema change
- Use descriptive names (create_users_table.sql)
- Always enable RLS: ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;
- Add appropriate policies for INSERT, SELECT, UPDATE, DELETE`;

    case 'auth':
      return verbosity === 'minimal'
        ? 'Auth: Email/password only, no confirmation, RLS policies for users.'
        : `Authentication Setup:
- Use Supabase built-in auth with email/password
- Disable email confirmation unless required
- Create user management flows
- Set up RLS policies based on auth.uid()`;

    case 'queries':
      return verbosity === 'minimal'
        ? 'Queries: Use Supabase client, handle errors, respect RLS.'
        : `Query Operations:
- Use Supabase client for all database operations
- Implement proper error handling
- Respect RLS policies in queries
- Use TypeScript types for query results`;

    case 'migration':
      return verbosity === 'minimal'
        ? 'Migrations: New file per change, complete content, no diffs.'
        : `Migration Best Practices:
- Create new migration file for each logical change
- Provide COMPLETE file content, never use diffs
- Use IF EXISTS/IF NOT EXISTS for safe operations
- Include rollback considerations`;

    default:
      return '';
  }
}

/**
 * Emergency fallback for when Supabase connection fails
 */
export function getSupabaseErrorFallback(verbosity: VerbosityLevel = 'standard'): string {
  return verbosity === 'minimal'
    ? 'Supabase connection failed. Use JavaScript-only databases (libsql, sqlite).'
    : `<database_fallback>
Supabase connection failed. Fallback options:
- Use JavaScript-implemented databases (libsql, better-sqlite3)
- Local SQLite with @sqlite.org/sqlite-wasm
- In-memory storage for prototyping
- Remind user to check Supabase connection
</database_fallback>`;
}

/**
 * Token count estimates for different instruction types
 */
export const SUPABASE_TOKEN_ESTIMATES = {
  minimal: 70,
  standard: 180,
  detailed: 400,
  not_connected: 25,
  project_creation: 110,
  project_selection: 90,
  project_setup: 140,
} as const;

/**
 * Calculates estimated tokens for Supabase instructions
 */
export function estimateSupabaseTokens(
  connectionState: SupabaseConnectionState,
  verbosity: VerbosityLevel = 'standard',
  context?: 'schema' | 'auth' | 'queries' | 'migration' | 'general',
): number {
  const normalized = normalizeSupabaseConnectionState(connectionState as any);
  const workflow = analyzeSupabaseContext(normalized);

  if (!normalized.token) {
    return SUPABASE_TOKEN_ESTIMATES.not_connected;
  }

  if (workflow.needsProject && workflow.projectsAvailable === 0) {
    return SUPABASE_TOKEN_ESTIMATES.project_creation;
  }

  if (workflow.needsProjectSelection) {
    return SUPABASE_TOKEN_ESTIMATES.project_selection;
  }

  if (workflow.needsSetup) {
    return SUPABASE_TOKEN_ESTIMATES.project_setup;
  }

  let baseTokens = SUPABASE_TOKEN_ESTIMATES[verbosity];

  // Add context-specific tokens
  if (context) {
    const contextTokens = verbosity === 'minimal' ? 15 : 40;
    baseTokens += contextTokens;
  }

  return baseTokens;
}
