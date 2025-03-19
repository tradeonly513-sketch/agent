import type { Message } from 'ai';
import { toast } from 'react-toastify';
import {
  detectProjectCommands,
  createCommandsMessage,
  escapeBoltTags,
  type FileContent,
} from '~/utils/projectCommands';
import { generateId } from '~/utils/fileUtils';
import JSZip from 'jszip';

// Determines if a file should be included.
function shouldIncludeFile(filePath: string): boolean {
  // Exclude files starting with a dot, etc.
  return !filePath.startsWith('.');
}

// Determines if a file is binary based on its extension.
function isBinaryFile(filePath: string): boolean {
  const binaryExtensions = ['png', 'jpg', 'jpeg', 'gif', 'ico', 'pdf', 'pyc', 'exe', 'bin'];
  const ext = filePath.split('.').pop()?.toLowerCase() || '';

  return binaryExtensions.includes(ext);
}

/*
 * =======================
 * API & ZIP Functions
 * =======================
 */

/**
 * Fetches a signed URL from your API and downloads the ZIP file.
 */
async function fetchZipFromDataApp(dataAppId: string, token: string): Promise<JSZip> {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  // Get data app information.
  const dataAppResponse = await fetch(`/api2/api/dataapps/by-id/${dataAppId}`, {
    method: 'GET',
    headers,
  });
  const dataAppJson: any = await dataAppResponse.json();
  const appTemplateId = dataAppJson.appTemplateId;

  // Get template info.
  const appTemplateResponse = await fetch(`/api2/api/app-templates/${appTemplateId}`, {
    method: 'GET',
    headers,
  });
  const appTemplateResponseJson: any = await appTemplateResponse.json();

  const payload = {
    fileName: `${appTemplateResponseJson.name}.zip`,
    signedUrlObjectType: 'APP_TEMPLATE_REACTJS',
    metadata: { appType: 'reactjs', SOURCE: 'TENANT' },
  };

  const response = await fetch('/api2/api/signed-url/generate-file-download-url', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers,
  });
  const result: any = await response.json();
  const signedUrl = result.signedUrl;

  if (!signedUrl) {
    throw new Error('Signed download URL not found.');
  }

  // Download the ZIP file.
  const zipResponse = await fetch(signedUrl, {
    headers: result.headers,
  });
  const blob = await zipResponse.blob();
  const zipArrayBuffer = await blob.arrayBuffer();

  return await JSZip.loadAsync(zipArrayBuffer);
}

/**
 * Processes the entries of the ZIP file.
 *
 * Returns an object containing file artifacts (with path and text content),
 * a list of skipped file paths, and the folder name extracted from the template info.
 */
async function processZipEntries(
  zip: JSZip,
  folderName: string,
): Promise<{
  fileArtifacts: FileContent[];
  skippedFiles: string[];
}> {
  const textDecoder = new TextDecoder('utf-8');
  const MAX_FILE_SIZE = 500 * 1024; // 500KB per file.
  const MAX_TOTAL_SIZE = 5 * 1024 * 1024; // Total allowed: 5MB.
  let totalSize = 0;
  const skippedFiles: string[] = [];
  const fileArtifacts: Array<{ path: string; content: string }> = [];

  const entries = Object.values(zip.files);

  for (const entry of entries) {
    const relativePath = entry.name;

    const normalizedPath = normalizeRelativePath(relativePath, folderName);

    if (!normalizedPath) {
      continue;
    }

    if (!shouldIncludeFile(relativePath) || entry.dir) {
      continue;
    }

    if (isBinaryFile(relativePath)) {
      skippedFiles.push(relativePath);
      continue;
    }

    let content: string;

    try {
      content = await entry.async('string');
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      // Fallback: decode as Uint8Array.
      const uint8Content = await entry.async('uint8array');
      content = textDecoder.decode(uint8Content);
    }

    const fileSize = new TextEncoder().encode(content).length;

    if (fileSize > MAX_FILE_SIZE) {
      skippedFiles.push(`${relativePath} (too large: ${Math.round(fileSize / 1024)}KB)`);
      continue;
    }

    if (totalSize + fileSize > MAX_TOTAL_SIZE) {
      skippedFiles.push(`${relativePath} (would exceed total size limit)`);
      continue;
    }

    console.log({ normalizedPath });

    totalSize += fileSize;
    fileArtifacts.push({ path: normalizedPath, content });
  }

  return { fileArtifacts, skippedFiles };
}

/**
 * Builds a chat message using the file artifacts and any skipped file information.
 */
function buildChatMessage(
  fileArtifacts: Array<{ path: string; content: string }>,
  skippedFiles: string[],
  folderName: string,
): Message {
  const binaryFilesMessage =
    skippedFiles.length > 0
      ? `\n\nSkipped ${skippedFiles.length} binary or oversized files:\n${skippedFiles.map((f) => `- ${f}`).join('\n')}`
      : '';

  return {
    role: 'assistant',
    content: `I've imported the contents of the "${folderName}" folder.${binaryFilesMessage}

<boltArtifact id="imported-files" title="Imported Files" type="bundled">
${fileArtifacts
  .map(
    (file) =>
      `<boltAction type="file" filePath="${file.path}">
${escapeBoltTags(file.content)}
</boltAction>`,
  )
  .join('\n\n')}
</boltArtifact>`,
    id: generateId(),
    createdAt: new Date(),
  };
}

/**
 * Normalize the relative path from a ZIP entry.
 *
 * - Skips __MACOSX entries.
 * - Removes leading common folder (if provided).
 * - Optionally returns only the folder (without the file name).
 *
 * @param relativePath The original relative path from the ZIP entry.
 * @param commonFolder Optional common folder name to remove.
 */
export function normalizeRelativePath(relativePath: string, commonFolder?: string): string | null {
  // Ignore unwanted __MACOSX entries or those starting with ._
  if (relativePath.startsWith('__MACOSX') || /\/\._/.test(relativePath)) {
    return null;
  }

  let normalized = relativePath;

  // If a common folder is provided, remove it from the beginning.
  if (commonFolder && normalized.startsWith(commonFolder)) {
    normalized = normalized.slice(commonFolder.length);
    normalized = normalized.replace(/^\/+/, '');
  }

  return normalized;
}

/**
 * Loads files from the API (via ZIP extraction) and imports them as chat messages.
 */
export async function loadFilesFromDataApp(
  dataAppId: string,
  token: string,
  importChat: (description: string, messages: Message[]) => Promise<void>,
): Promise<void> {
  try {
    // Fetch the ZIP from the API.
    const zip = await fetchZipFromDataApp(dataAppId, token);

    /*
     * For folder naming, you could extract the name from the template info.
     * Here we assume the folder name is derived from the ZIP file name.
     */
    const folderName = zip.files ? Object.keys(zip.files)[0].split('/')[0] : 'DataApp Files';

    console.log({ folderName });

    // Process ZIP entries.
    const { fileArtifacts, skippedFiles } = await processZipEntries(zip, folderName);

    // Detect project commands if needed.
    const commands = await detectProjectCommands(fileArtifacts);
    const commandsMessage = createCommandsMessage(commands);

    // Build the main chat message.
    const filesMessage = buildChatMessage(fileArtifacts, skippedFiles, folderName);
    const messages: Message[] = [filesMessage];

    if (commandsMessage) {
      messages.push(commandsMessage);
    }

    // Import the chat messages (this updates your UI).
    await importChat(folderName, messages);
  } catch (error: any) {
    console.error('Error loading files from API:', error);
    toast.error('Failed to load files from API: ' + error.message);
  }
}
