import { json, type MetaFunction } from '@remix-run/cloudflare';

export const meta: MetaFunction = () => {
  return [{ title: 'API Key Test' }, { name: 'description', content: 'Test API key configuration' }];
};

export const loader = () => json({});

/**
 * Test page for API key configuration and provider validation
 */
export default function ApiKeyTestPage() {
  return (
    <div className="flex flex-col h-full w-full bg-bolt-elements-background-depth-1 p-8">
      <h1 className="text-2xl font-bold text-bolt-elements-textPrimary mb-6">API Key Configuration Test</h1>

      <div className="max-w-4xl space-y-6">
        <div className="bg-bolt-elements-background-depth-2 p-4 rounded-lg">
          <h2 className="text-lg font-semibold text-bolt-elements-textPrimary mb-4">🔧 API Key Fixes:</h2>
          <ul className="space-y-2 text-sm text-bolt-elements-textSecondary">
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✓</span>
              <span>
                <strong>Default Model Changed:</strong> From claude-3-5-sonnet-latest to gpt-4o (OpenAI)
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✓</span>
              <span>
                <strong>Provider Validation:</strong> Check model/provider compatibility before sending
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✓</span>
              <span>
                <strong>API Key Error Detection:</strong> Clear error messages for missing API keys
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✓</span>
              <span>
                <strong>Auto-Fallback:</strong> Automatic fallback to compatible model/provider
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 mt-0.5">✓</span>
              <span>
                <strong>Empty Message Filter:</strong> Prevent empty assistant messages
              </span>
            </li>
          </ul>
        </div>

        <div className="bg-bolt-elements-background-depth-2 p-4 rounded-lg">
          <h2 className="text-lg font-semibold text-bolt-elements-textPrimary mb-4">🔑 API Key Configuration Guide:</h2>

          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-bolt-elements-textSecondary mb-2">
                OpenAI (Recommended Default):
              </h3>
              <div className="bg-bolt-elements-background-depth-1 p-3 rounded text-xs text-bolt-elements-textTertiary">
                <p>
                  <strong>Model:</strong> gpt-4o
                </p>
                <p>
                  <strong>API Key:</strong> Get from{' '}
                  <a
                    href="https://platform.openai.com/api-keys"
                    target="_blank"
                    className="text-blue-500 hover:underline"
                  >
                    OpenAI Platform
                  </a>
                </p>
                <p>
                  <strong>Setup:</strong> Settings → Cloud Providers → OpenAI → Enter API Key
                </p>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-bolt-elements-textSecondary mb-2">Anthropic (Claude):</h3>
              <div className="bg-bolt-elements-background-depth-1 p-3 rounded text-xs text-bolt-elements-textTertiary">
                <p>
                  <strong>Model:</strong> claude-3-5-sonnet-latest
                </p>
                <p>
                  <strong>API Key:</strong> Get from{' '}
                  <a
                    href="https://console.anthropic.com/settings/keys"
                    target="_blank"
                    className="text-blue-500 hover:underline"
                  >
                    Anthropic Console
                  </a>
                </p>
                <p>
                  <strong>Setup:</strong> Settings → Cloud Providers → Anthropic → Enter API Key
                </p>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-bolt-elements-textSecondary mb-2">Other Providers:</h3>
              <div className="bg-bolt-elements-background-depth-1 p-3 rounded text-xs text-bolt-elements-textTertiary">
                <p>Google, Groq, OpenRouter, etc. - Configure in Settings → Cloud Providers</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-bolt-elements-background-depth-2 p-4 rounded-lg">
          <h2 className="text-lg font-semibold text-bolt-elements-textPrimary mb-4">⚡ Error Prevention:</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-bolt-elements-background-depth-1 p-3 rounded">
              <h3 className="text-sm font-medium text-bolt-elements-textPrimary mb-2">Before Fix</h3>
              <ul className="text-xs text-bolt-elements-textSecondary space-y-1">
                <li>❌ "Missing API key for AmazonBedrock"</li>
                <li>❌ "message must not be empty"</li>
                <li>❌ Model/provider mismatch</li>
                <li>❌ No error recovery</li>
              </ul>
            </div>
            <div className="bg-bolt-elements-background-depth-1 p-3 rounded">
              <h3 className="text-sm font-medium text-bolt-elements-textPrimary mb-2">After Fix</h3>
              <ul className="text-xs text-bolt-elements-textSecondary space-y-1">
                <li>✅ Clear API key error messages</li>
                <li>✅ Automatic message validation</li>
                <li>✅ Model/provider compatibility check</li>
                <li>✅ Auto-fallback to working config</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="bg-bolt-elements-background-depth-2 p-4 rounded-lg">
          <h2 className="text-lg font-semibold text-bolt-elements-textPrimary mb-4">🧪 Testing Instructions:</h2>
          <ol className="space-y-2 text-sm text-bolt-elements-textSecondary">
            <li className="flex items-start gap-2">
              <span className="text-blue-500 font-medium">1.</span>
              <span>Go to Settings and configure at least one API key (OpenAI recommended)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 font-medium">2.</span>
              <span>Return to home page and switch to Agent mode</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 font-medium">3.</span>
              <span>Enter a request like "Create a simple React todo app"</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 font-medium">4.</span>
              <span>Verify that the request processes without API key errors</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 font-medium">5.</span>
              <span>Check browser console for validation logs</span>
            </li>
          </ol>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
          <h2 className="text-lg font-semibold text-yellow-800 mb-2">⚠️ Important Notes:</h2>
          <ul className="space-y-1 text-sm text-yellow-700">
            <li>• Default model is now gpt-4o (OpenAI) for better compatibility</li>
            <li>• System will auto-validate model/provider combinations</li>
            <li>• Clear error messages will guide you to fix configuration issues</li>
            <li>• Empty messages are automatically filtered to prevent API errors</li>
            <li>• If no API key is configured, you'll get helpful setup instructions</li>
          </ul>
        </div>

        <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
          <h2 className="text-lg font-semibold text-green-800 mb-2">✅ Expected Results:</h2>
          <ul className="space-y-1 text-sm text-green-700">
            <li>• No more "Missing API key for AmazonBedrock" errors</li>
            <li>• No more "message must not be empty" errors</li>
            <li>• Agent mode works smoothly from first try</li>
            <li>• Clear guidance when configuration is needed</li>
            <li>• Automatic recovery from common errors</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
