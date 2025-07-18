// Test script to verify the template initialization fix
// This script simulates the template loading process to ensure it doesn't exceed size limits

import { getTemplates } from './app/utils/selectStarterTemplate.ts';

async function testTemplateFix() {
  console.log('🧪 Testing template initialization fix...');
  
  try {
    // Test with a template that might have many files
    const result = await getTemplates('react-basic-starter', 'Test Project');
    
    if (!result) {
      console.log('❌ No template result returned');
      return;
    }
    
    const { assistantMessage, userMessage, additionalMessages, totalBatches, totalFiles } = result;
    
    console.log('✅ Template processing successful!');
    console.log(`📊 Statistics:`);
    console.log(`   - Total files: ${totalFiles}`);
    console.log(`   - Total batches: ${totalBatches}`);
    console.log(`   - Additional messages: ${additionalMessages?.length || 0}`);
    console.log(`   - Assistant message size: ${assistantMessage.length} characters`);
    console.log(`   - User message size: ${userMessage.length} characters`);
    
    // Check if the assistant message is within reasonable limits (< 60KB)
    const maxSize = 60000; // 60KB limit
    if (assistantMessage.length > maxSize) {
      console.log(`⚠️  Warning: Assistant message is still large (${assistantMessage.length} chars)`);
    } else {
      console.log(`✅ Assistant message size is within limits (${assistantMessage.length} chars)`);
    }
    
    // Check if additional messages exist for large templates
    if (totalBatches > 1) {
      console.log(`✅ Large template properly split into ${totalBatches} batches`);
      if (additionalMessages && additionalMessages.length > 0) {
        console.log(`✅ Additional messages created for remaining batches`);
        additionalMessages.forEach((msg, index) => {
          console.log(`   - Batch ${index + 2}: ${msg.content.length} characters`);
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testTemplateFix();
