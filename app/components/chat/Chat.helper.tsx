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

function shouldIncludeFile(filePath: string): boolean {
  return !filePath.startsWith('.');
}

function isBinaryFile(filePath: string): boolean {
  const binaryExtensions = ['png', 'jpg', 'jpeg', 'gif', 'ico', 'pdf', 'pyc', 'exe', 'bin'];
  const ext = filePath.split('.').pop()?.toLowerCase() || '';

  return binaryExtensions.includes(ext);
}

const BASE_URL = 'https://test.dev.rapidcanvas.net/';

async function getAppTemplate(dataAppId: string, token: string): Promise<string> {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  const dataAppResponse = await fetch(`${BASE_URL}/api/dataapps/by-id/${dataAppId}/detailed`, {
    method: 'GET',
    headers,
  });
  const dataAppJson: any = await dataAppResponse.json();
  const appTemplateName = dataAppJson.appTemplate.name;

  return appTemplateName;
}

async function fetchZipFromDataApp(appTemplateName: string, token: string): Promise<JSZip> {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
  const payload = {
    fileName: `${appTemplateName}.zip`,
    signedUrlObjectType: 'APP_TEMPLATE_REACTJS',
    metadata: { appType: 'reactjs', SOURCE: 'TENANT' },
  };

  const response = await fetch(`${BASE_URL}/api/signed-url/generate-file-download-url`, {
    method: 'POST',
    body: JSON.stringify(payload),
    headers,
  });
  const result: any = await response.json();
  const signedUrl = result.signedUrl;

  if (!signedUrl) {
    throw new Error('Signed download URL not found.');
  }

  const zipResponse = await fetch(signedUrl, {
    headers: result.headers,
  });
  const blob = await zipResponse.blob();
  const zipArrayBuffer = await blob.arrayBuffer();

  return await JSZip.loadAsync(zipArrayBuffer);
}

async function processZipEntries(
  zip: JSZip,
  folderName: string,
): Promise<{
  fileArtifacts: FileContent[];
  skippedFiles: string[];
}> {
  const textDecoder = new TextDecoder('utf-8');

  const skippedFiles: string[] = [];
  const fileArtifacts: Array<{ path: string; content: string }> = [];

  const entries = Object.values(zip.files);

  for (const entry of entries) {
    const relativePath = entry.name;

    const normalizedPath = normalizeRelativePath(relativePath, folderName);

    if (!normalizedPath || !shouldIncludeFile(relativePath) || entry.dir) {
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
      const uint8Content = await entry.async('uint8array');
      content = textDecoder.decode(uint8Content);
    }

    fileArtifacts.push({ path: normalizedPath, content });
  }

  return { fileArtifacts, skippedFiles };
}

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

export function normalizeRelativePath(relativePath: string, commonFolder?: string): string | null {
  if (relativePath.startsWith('__MACOSX') || /\/\._/.test(relativePath)) {
    return null;
  }

  let normalized = relativePath;

  if (commonFolder && normalized.startsWith(commonFolder)) {
    normalized = normalized.slice(commonFolder.length);
    normalized = normalized.replace(/^\/+/, '');
  }

  return normalized;
}

export async function loadFilesFromDataApp(
  dataAppId: string,
  token: string,
  importChat: (description: string, messages: Message[]) => Promise<void>,
): Promise<void> {
  try {
    const folderName = await getAppTemplate(dataAppId, token);
    const zip = await fetchZipFromDataApp(folderName, token);

    const { fileArtifacts, skippedFiles } = await processZipEntries(zip, folderName);

    const commands = await detectProjectCommands(fileArtifacts);
    const commandsMessage = createCommandsMessage(commands);

    const filesMessage = buildChatMessage(fileArtifacts, skippedFiles, folderName);
    const messages: Message[] = [filesMessage];

    if (commandsMessage) {
      messages.push(commandsMessage);
    }

    await importChat(folderName, messages);
  } catch (error: any) {
    console.error('Error loading files from API:', error);
    toast.error('Failed to load files from API: ' + error.message);
  }
}

export async function updateDataAppFiles(dataAppId: string, token: string, file: File): Promise<JSZip> {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  const dataAppResponse = await fetch(`${BASE_URL}/api/dataapps/by-id/${dataAppId}/detailed`, {
    method: 'GET',
    headers,
  });
  const dataAppJson: any = await dataAppResponse.json();

  const payload = {
    fileName: `${dataAppJson.appTemplate.name}.zip`,
    signedUrlObjectType: 'APP_TEMPLATE_REACTJS',
    metadata: { appType: 'reactjs', SOURCE: 'TENANT' },
  };

  const response = await fetch(`${BASE_URL}/api/signed-url/generate-file-upload-url`, {
    method: 'POST',
    body: JSON.stringify(payload),
    headers,
  });
  const result: any = await response.json();
  const signedUrl = result.signedUrl;

  if (!signedUrl) {
    throw new Error('Signed upload URL not found.');
  }

  const zipResponse = await fetch(signedUrl, {
    headers: result.headers,
    method: 'PUT',
    body: file,
  });
  const blob = await zipResponse.blob();
  const zipArrayBuffer = await blob.arrayBuffer();

  return await JSZip.loadAsync(zipArrayBuffer);
}
