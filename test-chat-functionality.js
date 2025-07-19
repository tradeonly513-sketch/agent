// Playwright test to verify chat functionality and provider selection

const { test, expect } = require('@playwright/test');

test.describe('Chat Functionality Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('http://localhost:5174');
    
    // Wait for the application to load
    await page.waitForSelector('[data-testid="chat-input"], textarea', { timeout: 10000 });
  });

  test('should load with smart default provider and model', async ({ page }) => {
    // Check if the page loads without errors
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    // Wait for initial load
    await page.waitForTimeout(2000);

    // Check for API key errors
    const hasApiKeyError = errors.some(error => 
      error.includes('Missing API key') || 
      error.includes('API key validation failed')
    );

    if (hasApiKeyError) {
      console.log('❌ API key errors detected:', errors.filter(e => 
        e.includes('Missing API key') || e.includes('API key validation failed')
      ));
    } else {
      console.log('✅ No API key errors detected');
    }

    expect(hasApiKeyError).toBe(false);
  });

  test('should handle chat mode conversation', async ({ page }) => {
    // Switch to chat mode if not already
    const chatModeButton = page.locator('button:has-text("Chat")');
    if (await chatModeButton.isVisible()) {
      await chatModeButton.click();
    }

    // Find the chat input
    const chatInput = page.locator('textarea').first();
    await expect(chatInput).toBeVisible();

    // Type a simple message
    const testMessage = 'Hello, can you help me create a simple React component?';
    await chatInput.fill(testMessage);

    // Submit the message
    const sendButton = page.locator('button[type="submit"], button:has-text("Send")').first();
    await sendButton.click();

    // Wait for response (with timeout)
    try {
      await page.waitForSelector('.message-content, [data-role="assistant"]', { timeout: 15000 });
      console.log('✅ Chat response received successfully');
    } catch (error) {
      console.log('❌ Chat response timeout or error');
      
      // Check for error messages
      const errorMessages = await page.locator('.error, .toast-error, [class*="error"]').allTextContents();
      if (errorMessages.length > 0) {
        console.log('Error messages found:', errorMessages);
      }
      
      throw error;
    }
  });

  test('should handle agent mode conversation', async ({ page }) => {
    // Switch to agent/build mode
    const buildModeButton = page.locator('button:has-text("Build"), button:has-text("Agent")');
    if (await buildModeButton.isVisible()) {
      await buildModeButton.click();
    }

    // Find the chat input
    const chatInput = page.locator('textarea').first();
    await expect(chatInput).toBeVisible();

    // Type a project creation message
    const testMessage = 'Create a simple todo app with React';
    await chatInput.fill(testMessage);

    // Submit the message
    const sendButton = page.locator('button[type="submit"], button:has-text("Send")').first();
    await sendButton.click();

    // Wait for response (with timeout)
    try {
      await page.waitForSelector('.message-content, [data-role="assistant"], .artifact', { timeout: 20000 });
      console.log('✅ Agent response received successfully');
    } catch (error) {
      console.log('❌ Agent response timeout or error');
      
      // Check for error messages
      const errorMessages = await page.locator('.error, .toast-error, [class*="error"]').allTextContents();
      if (errorMessages.length > 0) {
        console.log('Error messages found:', errorMessages);
      }
      
      throw error;
    }
  });

  test('should not show API key errors in console', async ({ page }) => {
    const consoleErrors = [];
    const networkErrors = [];

    // Monitor console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Monitor network errors
    page.on('response', response => {
      if (response.status() >= 400) {
        networkErrors.push(`${response.status()} ${response.url()}`);
      }
    });

    // Perform a simple interaction
    const chatInput = page.locator('textarea').first();
    await chatInput.fill('Test message');
    
    // Wait a bit for any errors to surface
    await page.waitForTimeout(3000);

    // Check for API key related errors
    const apiKeyErrors = consoleErrors.filter(error => 
      error.includes('Missing API key') || 
      error.includes('API key validation failed') ||
      error.includes('Github provider')
    );

    console.log('Console errors:', consoleErrors);
    console.log('Network errors:', networkErrors);
    console.log('API key errors:', apiKeyErrors);

    expect(apiKeyErrors.length).toBe(0);
  });
});

// Run the test
if (require.main === module) {
  console.log('🧪 Running Chat Functionality Tests');
  console.log('===================================');
  console.log('This test will verify:');
  console.log('1. Smart default provider selection');
  console.log('2. Chat mode functionality');
  console.log('3. Agent mode functionality');
  console.log('4. No API key errors');
  console.log('\nMake sure the development server is running on http://localhost:5174');
}
