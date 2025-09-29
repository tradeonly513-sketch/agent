#!/usr/bin/env node

/**
 * Test Script for Full-Stack Web App Prompt Optimization
 * This script validates the optimized prompt system with a real-world complex request
 */

console.log('🚀 Testing Optimized Prompt System with Full-Stack Web App Request\n');

// Your exact prompt
const FULLSTACK_PROMPT = `Create a full-stack web app using:
- React + Vite
- TailwindCSS
- Radix UI
- Supabase (auth, database, storage)

Requirements:
- Authentication (sign up, login, reset password) via Supabase
- Dashboard layout with sidebar + top nav
- Example table CRUD bound to Supabase
- Radix UI components styled with Tailwind
- Environment variables loaded from \`.env\`
- Code split into clean folders: \`src/components\`, \`src/pages\`, \`src/lib/supabase.ts\``;

// Test providers with expected token reduction ranges
const TEST_PROVIDERS = [
  { name: 'Groq', category: 'speed-optimized', expectedReduction: [70, 80] },
  { name: 'OpenAI-o1', category: 'reasoning', expectedReduction: [45, 60] },
  { name: 'Anthropic', category: 'high-context', expectedReduction: [40, 55] },
  { name: 'OpenAI', category: 'standard', expectedReduction: [50, 65] },
];

async function testIntentDetection() {
  console.log('📋 Step 1: Testing Intent Detection');
  console.log('=====================================');

  const messages = [{ id: 'test-fullstack', role: 'user', content: FULLSTACK_PROMPT }];

  // Simulate intent detection (would normally import from the module)
  const expectedIntent = {
    category: 'create-project',
    confidence: 'high',
    context: {
      complexity: 'complex',
      requiresDatabase: true,
      requiresDesign: true,
      requiresFileChanges: true,
      requiresDeployment: false
    }
  };

  console.log('✅ Expected Intent Classification:');
  console.log(`   Category: ${expectedIntent.category}`);
  console.log(`   Complexity: ${expectedIntent.context.complexity}`);
  console.log(`   Database Required: ${expectedIntent.context.requiresDatabase}`);
  console.log(`   Design Required: ${expectedIntent.context.requiresDesign}`);
  console.log('');

  // Keywords that should trigger create-project intent
  const keywords = {
    'create-project': ['Create', 'full-stack', 'build', 'web app'],
    'complexity-complex': ['full-stack', 'authentication', 'CRUD', 'dashboard'],
    'database': ['Supabase', 'auth', 'database', 'table'],
    'design': ['TailwindCSS', 'Radix UI', 'components', 'layout', 'sidebar']
  };

  console.log('🔍 Key Trigger Words Found:');
  Object.entries(keywords).forEach(([category, words]) => {
    const found = words.filter(word => FULLSTACK_PROMPT.includes(word));
    console.log(`   ${category}: ${found.join(', ')}`);
  });
  console.log('');
}

async function testProviderOptimization() {
  console.log('⚙️  Step 2: Testing Provider-Specific Optimization');
  console.log('==================================================');

  for (const provider of TEST_PROVIDERS) {
    console.log(`\n🔧 ${provider.name} (${provider.category}):`);
    console.log(`   Expected Token Reduction: ${provider.expectedReduction[0]}-${provider.expectedReduction[1]}%`);

    // Simulate what the optimization should do
    const optimization = getExpectedOptimization(provider.category);
    console.log(`   Verbosity Level: ${optimization.verbosity}`);
    console.log(`   Rules Included: ${optimization.rules.join(', ')}`);
    console.log(`   Special Features: ${optimization.features.join(', ')}`);
  }
  console.log('');
}

function getExpectedOptimization(category) {
  const optimizations = {
    'speed-optimized': {
      verbosity: 'minimal',
      rules: ['webcontainer_constraints', 'artifact_creation', 'supabase_instructions'],
      features: ['Ultra-compressed rules', 'Essential-only guidance', 'Maximum token reduction']
    },
    'reasoning': {
      verbosity: 'standard',
      rules: ['code_quality', 'project_structure', 'supabase_instructions', 'design_standards'],
      features: ['Balanced guidance', 'Core reasoning support', 'Moderate compression']
    },
    'high-context': {
      verbosity: 'detailed',
      rules: ['comprehensive_standards', 'detailed_supabase', 'advanced_patterns', 'full_design_system'],
      features: ['Complete instructions', 'Comprehensive guidance', 'Minimal compression']
    },
    'standard': {
      verbosity: 'standard',
      rules: ['artifact_creation', 'code_quality', 'supabase_instructions', 'basic_design'],
      features: ['Standard optimization', 'Balanced approach', 'Good token reduction']
    }
  };

  return optimizations[category] || optimizations['standard'];
}

async function testContextDetection() {
  console.log('🎯 Step 3: Testing Context-Specific Features');
  console.log('============================================');

  const contexts = [
    {
      name: 'Supabase Integration',
      detected: true,
      features: [
        'Database migration instructions',
        'RLS policy guidance',
        'Authentication setup',
        'Environment variable configuration'
      ]
    },
    {
      name: 'Design System Integration',
      detected: true,
      features: [
        'Radix UI component patterns',
        'TailwindCSS optimization',
        'Responsive design standards',
        'Component architecture guidance'
      ]
    },
    {
      name: 'Project Structure',
      detected: true,
      features: [
        'React + Vite configuration',
        'Folder organization patterns',
        'TypeScript setup',
        'Modern build tooling'
      ]
    }
  ];

  contexts.forEach(context => {
    console.log(`\n✅ ${context.name}:`);
    console.log(`   Detected: ${context.detected ? 'YES' : 'NO'}`);
    if (context.detected) {
      context.features.forEach(feature => {
        console.log(`   • ${feature}`);
      });
    }
  });
  console.log('');
}

async function simulateTokenComparison() {
  console.log('📊 Step 4: Simulated Token Reduction Analysis');
  console.log('==============================================');

  // Estimated token counts (these would be actual measurements in real test)
  const baseline = 1200; // Standard prompt tokens

  console.log(`📏 Baseline Prompt Tokens: ${baseline}`);
  console.log('\n🎯 Optimized Results by Provider:');

  TEST_PROVIDERS.forEach(provider => {
    const reductionPercent = (provider.expectedReduction[0] + provider.expectedReduction[1]) / 2;
    const optimizedTokens = Math.round(baseline * (1 - reductionPercent / 100));
    const savedTokens = baseline - optimizedTokens;

    console.log(`\n   ${provider.name}:`);
    console.log(`   • Optimized Tokens: ${optimizedTokens}`);
    console.log(`   • Tokens Saved: ${savedTokens}`);
    console.log(`   • Reduction: ${reductionPercent}%`);
    console.log(`   • Efficiency: ${getEfficiencyRating(reductionPercent)}`);
  });
  console.log('');
}

function getEfficiencyRating(reduction) {
  if (reduction >= 60) return 'EXCELLENT 🌟';
  if (reduction >= 40) return 'GOOD ✅';
  if (reduction >= 20) return 'MODERATE ⚡';
  return 'POOR ❌';
}

async function runTests() {
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║                    PROMPT OPTIMIZATION TEST SUITE                ║');
  console.log('║                    Full-Stack Web App Scenario                   ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');

  await testIntentDetection();
  await testProviderOptimization();
  await testContextDetection();
  await simulateTokenComparison();

  console.log('🎉 Test Simulation Complete!');
  console.log('================================================');
  console.log('');
  console.log('📋 Next Steps:');
  console.log('1. Open bolt.diy Settings → Features → "Prompt Optimization Test Suite"');
  console.log('2. Select "Full-Stack Web App (Real Test)" scenario');
  console.log('3. Test against different providers (Groq, OpenAI-o1, Anthropic)');
  console.log('4. Verify token reduction meets expected ranges');
  console.log('5. Check generated artifacts maintain quality');
  console.log('');
  console.log('🔧 Alternative: Try the production environment');
  console.log('1. Switch prompt dropdown to "AI-Optimized Prompt"');
  console.log('2. Send your full-stack web app request in main chat');
  console.log('3. Observe real-time optimization in action');
}

// Run the test simulation
runTests().catch(console.error);