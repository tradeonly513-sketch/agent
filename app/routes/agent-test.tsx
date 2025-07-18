import { json, type MetaFunction } from '@remix-run/cloudflare';
import { AgentMessage } from '~/components/chat/AgentMessage';

export const meta: MetaFunction = () => {
  return [{ title: 'Agent Message Test' }, { name: 'description', content: 'Test Agent message display' }];
};

export const loader = () => json({});

/**
 * Test page for Agent message display
 */
export default function AgentTestPage() {
  const sampleAgentMessage = `[AGENT MODE] You are an intelligent development agent. Please analyze the following request and create a complete, working project with all necessary files. Be thorough and create production-ready code.

User Request: Create a React todo app with TypeScript

Instructions:
1. Create all necessary files for a complete project
2. Include proper project structure and dependencies
3. Write clean, well-documented code
4. Ensure the project is ready to run
5. Use modern best practices

Please proceed to create the project step by step.`;

  return (
    <div className="flex flex-col h-full w-full bg-bolt-elements-background-depth-1 p-8">
      <h1 className="text-2xl font-bold text-bolt-elements-textPrimary mb-6">Agent Message Display Test</h1>
      
      <div className="max-w-4xl space-y-6">
        <div className="bg-bolt-elements-background-depth-2 p-4 rounded-lg">
          <h2 className="text-lg font-semibold text-bolt-elements-textPrimary mb-4">Before Optimization:</h2>
          <div className="bg-bolt-elements-background-depth-1 p-3 rounded border text-sm text-bolt-elements-textSecondary">
            <pre className="whitespace-pre-wrap">{sampleAgentMessage}</pre>
          </div>
        </div>

        <div className="bg-bolt-elements-background-depth-2 p-4 rounded-lg">
          <h2 className="text-lg font-semibold text-bolt-elements-textPrimary mb-4">After Optimization:</h2>
          <div className="bg-bolt-elements-background-depth-1 p-3 rounded">
            <AgentMessage content={sampleAgentMessage} />
          </div>
        </div>

        <div className="bg-bolt-elements-background-depth-2 p-4 rounded-lg">
          <h2 className="text-lg font-semibold text-bolt-elements-textPrimary mb-4">Benefits:</h2>
          <ul className="space-y-2 text-sm text-bolt-elements-textSecondary">
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✓</span>
              <span>Compact display with clear Agent mode indicator</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✓</span>
              <span>User request prominently displayed</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✓</span>
              <span>System instructions hidden by default, expandable on demand</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✓</span>
              <span>Visual status indicators and animations</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✓</span>
              <span>Consistent with Bolt design system</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
