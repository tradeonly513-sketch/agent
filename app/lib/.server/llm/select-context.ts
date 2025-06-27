import { generateText, type CoreTool, type GenerateTextResult, type Message } from 'ai';
import ignore from 'ignore';
import type { IProviderSetting } from '~/types/model';
import { IGNORE_PATTERNS, type FileMap } from './constants';
import { DEFAULT_MODEL, DEFAULT_PROVIDER, PROVIDER_LIST } from '~/utils/constants';
import { createFilesContext, extractCurrentContext, extractPropertiesFromMessage, simplifyBoltActions } from './utils';
import { createScopedLogger } from '~/utils/logger';
import { LLMManager } from '~/lib/modules/llm/manager';
import GroqProviderClass from '~/lib/modules/llm/providers/groq';

// Common patterns to ignore, similar to .gitignore

const ig = ignore().add(IGNORE_PATTERNS);
const logger = createScopedLogger('select-context');

const CONTEXT_SELECTION_PROVIDER_NAME = 'Groq';
const CONTEXT_SELECTION_MODEL_ID = 'llama-3.1-8b-instant';

export async function selectContext(props: {
  messages: Message[];
  env?: Env;
  apiKeys?: Record<string, string>;
  files: FileMap;
  providerSettings?: Record<string, IProviderSetting>;
  promptId?: string;
  contextOptimization?: boolean;
  summary: string;
  onFinish?: (resp: GenerateTextResult<Record<string, CoreTool<any, any>>, never>) => void;
}) {
  const { messages, env: serverEnv, apiKeys, files, providerSettings, summary, onFinish } = props;
  let currentModel = DEFAULT_MODEL;
  let currentProvider = DEFAULT_PROVIDER.name;
  const processedMessages = messages.map((message) => {
    if (message.role === 'user') {
      const { model, provider, content } = extractPropertiesFromMessage(message);
      currentModel = model;
      currentProvider = provider;

      return { ...message, content };
    } else if (message.role == 'assistant') {
      let content = message.content;

      content = simplifyBoltActions(content);

      content = content.replace(/<div class=\\"__boltThought__\\">.*?<\/div>/s, '');
      content = content.replace(/<think>.*?<\/think>/s, '');

      return { ...message, content };
    }

    return message;
  });

  const provider = PROVIDER_LIST.find((p) => p.name === currentProvider) || DEFAULT_PROVIDER;
  const staticModels = LLMManager.getInstance().getStaticModelListFromProvider(provider);
  let modelDetails = staticModels.find((m) => m.name === currentModel);

  if (!modelDetails) {
    const modelsList = [
      ...(provider.staticModels || []),
      ...(await LLMManager.getInstance().getModelListFromProvider(provider, {
        apiKeys,
        providerSettings,
        serverEnv: serverEnv as any,
      })),
    ];

    if (!modelsList.length) {
      throw new Error(`No models found for provider ${provider.name}`);
    }

    modelDetails = modelsList.find((m) => m.name === currentModel);

    if (!modelDetails) {
      // Fallback to first model
      logger.warn(
        `MODEL [${currentModel}] not found in provider [${provider.name}]. Falling back to first model. ${modelsList[0].name}`,
      );
      modelDetails = modelsList[0];
    }
  }

  const { codeContext } = extractCurrentContext(processedMessages);

  let filePaths = getFilePaths(files || {});
  filePaths = filePaths.filter((x) => {
    const relPath = x.replace('/home/project/', '');
    return !ig.ignores(relPath);
  });

  let context = '';
  const currrentFiles: string[] = [];
  const contextFiles: FileMap = {};

  if (codeContext?.type === 'codeContext') {
    const codeContextFiles: string[] = codeContext.files;
    Object.keys(files || {}).forEach((path) => {
      let relativePath = path;

      if (path.startsWith('/home/project/')) {
        relativePath = path.replace('/home/project/', '');
      }

      if (codeContextFiles.includes(relativePath)) {
        contextFiles[relativePath] = files[path];
        currrentFiles.push(relativePath);
      }
    });
    context = createFilesContext(contextFiles);
  }

  const summaryText = `Here is the summary of the chat till now: ${summary}`;

  const extractTextContent = (message: Message) =>
    Array.isArray(message.content)
      ? (message.content.find((item) => item.type === 'text')?.text as string) || ''
      : message.content;

  const lastUserMessage = processedMessages.filter((x) => x.role == 'user').pop();

  if (!lastUserMessage) {
    throw new Error('No user message found');
  }

  // select files from the list of code file from the project that might be useful for the current request from the user
  const resp = await generateText({
    system: `
        You are a software engineer. You are working on a project. You have access to the following files:

        AVAILABLE FILES PATHS
        ---
        ${filePaths.map((path) => `- ${path}`).join('\n')}
        ---

        You have following code loaded in the context buffer that you can refer to:

        CURRENT CONTEXT BUFFER (contains the full content of these files):
        ---
        ${Object.keys(contextFiles).map(path => `- ${path}`).join('\n') || 'No files currently in context buffer.'}
        ---

        Now, you are given a task. You need to select the files that are relevant to the task from the list of files above.

        RESPONSE FORMAT:
        your response should be in following format:
---
<updateContextBuffer>
    <includeFile path="path/to/file"/>
    <excludeFile path="path/to/file"/>
</updateContextBuffer>
---
        * Your should start with <updateContextBuffer> and end with </updateContextBuffer>.
        * You can include multiple <includeFile> and <excludeFile> tags in the response.
        * You should not include any other text in the response.
        * You should not include any file that is not in the list of files above.
        * You should not include any file that is already in the context buffer.
        * If no changes are needed, you can leave the response empty updateContextBuffer tag.
        `,
    prompt: `
        ${summaryText}

        Users Question: ${extractTextContent(lastUserMessage)}

        update the context buffer with the files that are relevant to the task from the list of files above.

        CRITICAL RULES:
        * Only include relevant files in the context buffer.
        * context buffer should not include any file that is not in the list of files above.
        * context buffer is extremlly expensive, so only include files that are absolutely necessary.
        * If no changes are needed, you can leave the response empty updateContextBuffer tag.
        * Only 5 files can be placed in the context buffer at a time.
        * if the buffer is full, you need to exclude files that is not needed and include files that is relevent.

        `,
    model: new GroqProviderClass().getModelInstance({ // Use the dedicated Groq provider and model
      model: CONTEXT_SELECTION_MODEL_ID,
      serverEnv,
      apiKeys,
      providerSettings, // Ensure Groq provider settings are correctly picked up if needed
    }),
  });

  const response = resp.text;
  const updateContextBuffer = response.match(/<updateContextBuffer>([\s\S]*?)<\/updateContextBuffer>/);

  if (!updateContextBuffer) {
    throw new Error('Invalid response. Please follow the response format');
  }

  const includeFiles =
    updateContextBuffer[1]
      .match(/<includeFile path="(.*?)"/gm)
      ?.map((x) => x.replace('<includeFile path="', '').replace('"', '')) || [];
  const excludeFiles =
    updateContextBuffer[1]
      .match(/<excludeFile path="(.*?)"/gm)
      ?.map((x) => x.replace('<excludeFile path="', '').replace('"', '')) || [];

  // Start with a copy of the files already in context, then modify it.
  const newContextFiles: FileMap = { ...contextFiles };

  excludeFiles.forEach((path) => {
    // Ensure path normalization if necessary, though contextFiles should have normalized keys
    const normalizedPath = path.startsWith('/home/project/') ? path.substring('/home/project/'.length) : path;
    delete newContextFiles[normalizedPath];
    logger.debug(`Excluded file from context: ${normalizedPath}`);
  });

  let includedCount = 0;
  includeFiles.forEach((path) => {
    let fullPath = path;
    // Normalize path for lookup in `files` map (which uses full paths)
    if (!path.startsWith('/home/project/')) {
      fullPath = `/home/project/${path}`;
    }

    // Normalize path for keys in `newContextFiles` (which should be relative)
    const relativePath = path.startsWith('/home/project/') ? path.substring('/home/project/'.length) : path;

    if (!files[fullPath]) { // Check existence in the global `files` map
      logger.warn(`LLM tried to include file not available in project: ${path}`);
      return;
    }

    if (newContextFiles[relativePath]) { // Already in context (e.g. wasn't excluded)
      logger.debug(`File ${relativePath} is already in context or was re-included.`);
      // Potentially refresh content if it could change, but FileMap holds content.
      // newContextFiles[relativePath] = files[fullPath]; // Re-assign to ensure latest content if needed
      return;
    }

    // Add to context
    newContextFiles[relativePath] = files[fullPath];
    includedCount++;
    logger.debug(`Included file into context: ${relativePath}`);
  });

  if (onFinish) {
    onFinish(resp);
  }

  const finalContextFileCount = Object.keys(newContextFiles).length;
  logger.info(`Final context file count: ${finalContextFileCount}. Newly included by LLM: ${includedCount}. Excluded by LLM: ${excludeFiles.length}`);

  if (includedCount === 0 && excludeFiles.length === 0 && Object.keys(contextFiles).length > 0) {
    logger.warn('LLM made no changes to the context selection.');
    // No error, just proceed with the original contextFiles (which is effectively newContextFiles if no changes)
  }

  // Fallback: If the LLM's selection leads to an empty context,
  // and there were files before, it might be an error.
  // For now, we allow an empty context if the LLM decides so.
  // A more robust solution might be to revert to original contextFiles if newContextFiles is empty AND contextFiles was not.
  if (finalContextFileCount === 0 && Object.keys(files).length > 0) {
     logger.warn('LLM context selection resulted in an empty context. Proceeding with empty context.');
     // If this is undesirable, one might return the original `contextFiles` here:
     // logger.warn('LLM context selection resulted in an empty context. Reverting to original context for this turn.');
     // return contextFiles;
  }

  return newContextFiles;
}

export function getFilePaths(files: FileMap) {
  let filePaths = Object.keys(files);
  filePaths = filePaths.filter((x) => {
    const relPath = x.replace('/home/project/', '');
    return !ig.ignores(relPath);
  });

  return filePaths;
}
