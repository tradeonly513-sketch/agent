import { type ActionFunctionArgs, type LoaderFunctionArgs, json } from '@remix-run/cloudflare';
import { getApiKeysFromCookie, getProviderSettingsFromCookie } from '~/lib/api/cookies';
import { createScopedLogger } from '~/utils/logger';
import { BaseProvider, getOpenAILikeModel } from '~/lib/modules/llm/base-provider';
import { generateText } from 'ai';

const logger = createScopedLogger('BayerMGADebug');

// Define types for the API responses
interface ModelsTest {
  name: string;
  url: string;
  success: boolean;
  status: number;
  statusText: string;
  duration: string;
  headers: Record<string, string>;
  responsePreview: string;
  parsedModelsCount: number;
  availableModels: Array<{
    model: string;
    name: string;
    context_window: number;
  }>;
}

interface CompletionsTest {
  name: string;
  url: string;
  success: boolean;
  status: number;
  statusText: string;
  duration: string;
  headers: Record<string, string>;
  responsePreview: string;
  completionContent: string | null;
}

interface SdkTest {
  name: string;
  success: boolean;
  duration?: string;
  result?: any; // Changed from string to any to accommodate GenerateTextResult
  error?: string;
  stack?: string;
}

interface DebugResults {
  success: boolean;
  baseUrl?: string; // Made optional for error responses
  model?: string; // Made optional for error responses
  apiKeyProvided?: boolean; // Made optional for error responses
  apiKeyPrefix?: string | null;
  tests: Array<ModelsTest | CompletionsTest | SdkTest>;
  error?: string;
  errorStack?: string;
}

// Define type for the request body in the action function
interface DebugRequestBody {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  messages?: Array<{ role: string; content: string }>;
  system?: string;
}

// Add CORS headers to all responses
function addCorsHeaders(response: Response): Response {
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return response;
}

// Handle OPTIONS requests for CORS preflight
export async function loader({ request }: LoaderFunctionArgs) {
  if (request.method === 'OPTIONS') {
    return addCorsHeaders(new Response(null, { status: 204 }));
  }

  const url = new URL(request.url);
  const apiKey = url.searchParams.get('apiKey');
  const baseUrl = url.searchParams.get('baseUrl') || 'https://chat.int.bayer.com/api/v2';
  const model = url.searchParams.get('model') || 'gpt-4o-mini';

  // Get API key from cookies if not provided in query params
  let effectiveApiKey = apiKey;
  if (!effectiveApiKey) {
    const cookieHeader = request.headers.get('Cookie');
    const apiKeys = getApiKeysFromCookie(cookieHeader);
    effectiveApiKey = apiKeys?.['BayerMGA'];
  }

  if (!effectiveApiKey) {
    return addCorsHeaders(
      json(
        {
          success: false,
          error: 'No API key provided. Add ?apiKey=your_key to the URL or set it in the app settings.',
          tests: [],
        } as DebugResults,
        { status: 400 },
      ),
    );
  }

  // Normalize base URL (remove trailing slash)
  const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;

  // Results container
  const results: DebugResults = {
    success: true,
    baseUrl: normalizedBaseUrl,
    model,
    apiKeyProvided: !!effectiveApiKey,
    apiKeyPrefix: effectiveApiKey ? `${effectiveApiKey.substring(0, 4)}...` : null,
    tests: [],
  };

  // Test 1: Fetch models
  try {
    logger.info(`Testing models endpoint: ${normalizedBaseUrl}/models`);
    const modelsUrl = `${normalizedBaseUrl}/models?include_hidden_models=false&include_aliases=true`;
    
    const modelsStartTime = Date.now();
    const modelsResponse = await fetch(modelsUrl, {
      headers: {
        Authorization: `Bearer ${effectiveApiKey}`,
      },
    });
    const modelsEndTime = Date.now();

    const modelsResponseText = await modelsResponse.text();
    let modelsData;
    let parsedModels: Array<{ model: string; name: string; context_window: number }> = [];
    
    try {
      modelsData = JSON.parse(modelsResponseText);
      if (modelsData.data && Array.isArray(modelsData.data)) {
        parsedModels = modelsData.data
          .filter((model: any) => model.model_status === 'available')
          .map((model: any) => ({
            model: model.model,
            name: model.name,
            context_window: model.context_window,
          }));
      }
    } catch (e) {
      // JSON parse error
    }

    results.tests.push({
      name: 'Models Endpoint',
      url: modelsUrl,
      success: modelsResponse.ok,
      status: modelsResponse.status,
      statusText: modelsResponse.statusText,
      duration: `${modelsEndTime - modelsStartTime}ms`,
      headers: Object.fromEntries(modelsResponse.headers.entries()),
      responsePreview: modelsResponseText.substring(0, 500) + (modelsResponseText.length > 500 ? '...' : ''),
      parsedModelsCount: parsedModels.length,
      availableModels: parsedModels.slice(0, 5), // First 5 models only
    } as ModelsTest);

    // If models test failed, don't attempt completions test
    if (!modelsResponse.ok) {
      results.success = false;
      return addCorsHeaders(json(results));
    }

    // Test 2: Chat completions
    logger.info(`Testing chat completions endpoint: ${normalizedBaseUrl}/chat/completions`);
    const completionsUrl = `${normalizedBaseUrl}/chat/completions`;
    
    const completionsStartTime = Date.now();
    const completionsResponse = await fetch(completionsUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${effectiveApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'user',
            content: 'Hello from Buildify debug test. Please respond with a very short greeting.',
          },
        ],
        temperature: 0.2,
        stream: false,
      }),
    });
    const completionsEndTime = Date.now();

    const completionsResponseText = await completionsResponse.text();
    let completionsData;
    let completionContent = null;
    
    try {
      completionsData = JSON.parse(completionsResponseText);
      if (completionsData.choices && completionsData.choices.length > 0) {
        completionContent = completionsData.choices[0].message?.content;
      }
    } catch (e) {
      // JSON parse error
    }

    results.tests.push({
      name: 'Chat Completions Endpoint',
      url: completionsUrl,
      success: completionsResponse.ok,
      status: completionsResponse.status,
      statusText: completionsResponse.statusText,
      duration: `${completionsEndTime - completionsStartTime}ms`,
      headers: Object.fromEntries(completionsResponse.headers.entries()),
      responsePreview: completionsResponseText.substring(0, 500) + (completionsResponseText.length > 500 ? '...' : ''),
      completionContent,
    } as CompletionsTest);

    // Test 3: Using the AI SDK (same as the app)
    try {
      logger.info(`Testing AI SDK integration with ${normalizedBaseUrl}`);
      const sdkStartTime = Date.now();
      
      // This mimics exactly how the app uses the provider
      const openaiLike = getOpenAILikeModel(normalizedBaseUrl, effectiveApiKey, model);
      
      const result = await generateText({
        messages: [
          {
            role: 'user',
            content: 'Hello from Buildify AI SDK test. Please respond with a very short greeting.',
          },
        ],
        model: openaiLike,
        maxTokens: 100,
      });
      
      const sdkEndTime = Date.now();
      
      results.tests.push({
        name: 'AI SDK Integration',
        success: true,
        duration: `${sdkEndTime - sdkStartTime}ms`,
        result: result,
      } as SdkTest);
    } catch (error) {
      results.success = false;
      results.tests.push({
        name: 'AI SDK Integration',
        success: false,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      } as SdkTest);
    }

    return addCorsHeaders(json(results));
  } catch (error) {
    results.success = false;
    results.error = error instanceof Error ? error.message : String(error);
    results.errorStack = error instanceof Error ? error.stack : undefined;
    
    return addCorsHeaders(json(results, { status: 500 }));
  }
}

// Handle POST requests for more complex testing
export async function action({ request, context }: ActionFunctionArgs) {
  if (request.method === 'OPTIONS') {
    return addCorsHeaders(new Response(null, { status: 204 }));
  }

  try {
    // Parse request body with proper type checking
    const requestData = await request.json() as DebugRequestBody;
    const { apiKey, baseUrl, model, messages, system } = requestData;
    
    // Get API key from cookies if not provided in request body
    let effectiveApiKey = apiKey;
    if (!effectiveApiKey) {
      const cookieHeader = request.headers.get('Cookie');
      const apiKeys = getApiKeysFromCookie(cookieHeader);
      effectiveApiKey = apiKeys?.['BayerMGA'];
    }

    if (!effectiveApiKey) {
      return addCorsHeaders(
        json(
          {
            success: false,
            error: 'No API key provided in request body or cookies',
          },
          { status: 400 },
        ),
      );
    }

    // Normalize base URL
    const normalizedBaseUrl = (baseUrl || 'https://chat.int.bayer.com/api/v2').endsWith('/')
      ? (baseUrl || 'https://chat.int.bayer.com/api/v2').slice(0, -1)
      : (baseUrl || 'https://chat.int.bayer.com/api/v2');
    
    const effectiveModel = model || 'gpt-4o-mini';
    
    logger.info(`Testing AI SDK integration with custom messages: ${normalizedBaseUrl}`);
    
    // Create OpenAI-like model instance (same as the provider)
    const openaiLike = getOpenAILikeModel(normalizedBaseUrl, effectiveApiKey, effectiveModel);
    
    // Generate text using the AI SDK - fixing the messages type
    const result = await generateText({
      system: system || undefined,
      messages: messages ? 
        messages.map(m => ({ role: m.role as any, content: m.content })) : 
        [{ role: 'user' as const, content: 'Hello from Buildify custom test. Please respond with a very short greeting.' }],
      model: openaiLike,
      maxTokens: 500,
    });
    
    return addCorsHeaders(
      json({
        success: true,
        baseUrl: normalizedBaseUrl,
        model: effectiveModel,
        result,
      }),
    );
  } catch (error) {
    logger.error(`Error in debug action: ${error instanceof Error ? error.message : String(error)}`);
    
    return addCorsHeaders(
      json(
        {
          success: false,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
        { status: 500 },
      ),
    );
  }
}
