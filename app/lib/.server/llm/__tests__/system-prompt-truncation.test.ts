import { describe, it, expect } from 'vitest';

describe('System Prompt Truncation Logic', () => {
  it('should truncate oversized system prompts correctly', () => {
    // Simulate the exact truncation logic from stream-text.ts
    const modelContextWindow = 65536;
    const maxSystemPromptTokens = Math.floor(modelContextWindow * 0.4); // 40% = 26,214 tokens

    // Create a system prompt that's too large
    const basePrompt = 'You are a helpful coding assistant.';
    const largeCodeContext = 'function example() {\n  console.log("test");\n}\n'.repeat(5000); // ~150KB

    let systemPrompt = `${basePrompt}

Below is the artifact containing the context loaded into context buffer for you to have knowledge of and might need changes to fullfill current user request.
CONTEXT BUFFER:
---
${largeCodeContext}
---
`;

    const originalLength = systemPrompt.length;
    const estimatedSystemTokens = Math.ceil(originalLength / 4);

    console.log(`Original system prompt: ${originalLength} chars, ~${estimatedSystemTokens} tokens`);
    console.log(`Max allowed tokens: ${maxSystemPromptTokens}`);

    // Verify it's actually too large
    expect(estimatedSystemTokens).toBeGreaterThan(maxSystemPromptTokens);

    // Apply truncation logic (matching stream-text.ts)
    if (estimatedSystemTokens > maxSystemPromptTokens) {
      // Reserve space for the truncation note
      const truncationNote = '\n\n[Note: System prompt was truncated to fit context window]';
      const maxSystemPromptChars = maxSystemPromptTokens * 4 - truncationNote.length;
      const truncatedSystemPrompt = systemPrompt.substring(0, maxSystemPromptChars);

      // Try to truncate at a reasonable boundary
      const lastNewline = truncatedSystemPrompt.lastIndexOf('\n');
      const lastPeriod = truncatedSystemPrompt.lastIndexOf('.');
      const cutPoint = Math.max(lastNewline, lastPeriod);

      if (cutPoint > maxSystemPromptChars * 0.8) {
        systemPrompt = truncatedSystemPrompt.substring(0, cutPoint + 1);
      } else {
        systemPrompt = truncatedSystemPrompt;
      }

      systemPrompt += truncationNote;
    }

    const finalLength = systemPrompt.length;
    const finalEstimatedTokens = Math.ceil(finalLength / 4);

    console.log(`Final system prompt: ${finalLength} chars, ~${finalEstimatedTokens} tokens`);

    // Verify truncation worked
    expect(finalEstimatedTokens).toBeLessThanOrEqual(maxSystemPromptTokens);
    expect(finalLength).toBeLessThan(originalLength);
    expect(systemPrompt).toContain('[Note: System prompt was truncated to fit context window]');
    expect(systemPrompt).toContain(basePrompt); // Should preserve the base prompt
  });

  it('should not truncate system prompts that are within limits', () => {
    const modelContextWindow = 65536;
    const maxSystemPromptTokens = Math.floor(modelContextWindow * 0.4);

    // Create a small system prompt
    const systemPrompt = 'You are a helpful coding assistant. Please help with the following task.';
    const originalLength = systemPrompt.length;
    const estimatedSystemTokens = Math.ceil(originalLength / 4);

    // Verify it's within limits
    expect(estimatedSystemTokens).toBeLessThanOrEqual(maxSystemPromptTokens);

    // Should not be truncated
    let finalSystemPrompt = systemPrompt;

    if (estimatedSystemTokens > maxSystemPromptTokens) {
      // This should not execute
      finalSystemPrompt = 'TRUNCATED';
    }

    expect(finalSystemPrompt).toBe(systemPrompt);
    expect(finalSystemPrompt).not.toContain('[Note: System prompt was truncated');
  });

  it('should handle edge cases in truncation boundaries', () => {
    const modelContextWindow = 65536;
    const maxSystemPromptTokens = Math.floor(modelContextWindow * 0.4);
    const maxSystemPromptChars = maxSystemPromptTokens * 4;

    // Create a prompt that's exactly at the boundary
    const systemPrompt = 'A'.repeat(maxSystemPromptChars + 1000); // Slightly over limit

    const truncatedSystemPrompt = systemPrompt.substring(0, maxSystemPromptChars);
    const lastNewline = truncatedSystemPrompt.lastIndexOf('\n');
    const lastPeriod = truncatedSystemPrompt.lastIndexOf('.');
    const cutPoint = Math.max(lastNewline, lastPeriod);

    // Since this is all 'A's, there won't be newlines or periods
    expect(lastNewline).toBe(-1);
    expect(lastPeriod).toBe(-1);
    expect(cutPoint).toBe(-1);

    // Should fall back to character-based truncation
    let finalPrompt;

    if (cutPoint > maxSystemPromptChars * 0.8) {
      finalPrompt = truncatedSystemPrompt.substring(0, cutPoint + 1);
    } else {
      finalPrompt = truncatedSystemPrompt;
    }

    expect(finalPrompt.length).toBeLessThanOrEqual(maxSystemPromptChars);
  });
});
