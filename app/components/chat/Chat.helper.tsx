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

const BASE_URL = '/api1/';

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

async function saveFilesToServer(files: FileContent[], dataAppId: string, folderName: string): Promise<void> {
  try {
    const response = await fetch('/code-editor/api/files', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        files,
        dataAppId,
        folderName,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to save files: ${response.statusText}`);
    }
  } catch (error) {
    console.error('Failed to save files to server:', error);
  }
}

interface ApiResponse {
  fileArtifacts: FileContent[];
  skippedFiles: string[];
  folderName: string;
}

export async function loadFilesFromDataApp(
  dataAppId: string,
  token: string,
  importChat: (description: string, messages: Message[]) => Promise<void>,
): Promise<void> {
  try {
    const response = await fetch('/code-editor/api/get-files', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ dataAppId, token }),
    });

    if (!response.ok) {
      throw new Error(`Failed to process files: ${response.statusText}`);
    }

    const data = (await response.json()) as ApiResponse;
    const { fileArtifacts, skippedFiles, folderName } = data;

    // Save files to server
    await saveFilesToServer(fileArtifacts, dataAppId, folderName);
    await importChatFromFiles({ importChat, fileArtifacts, skippedFiles, folderName });
  } catch (error: any) {
    console.error('Error loading files from API:', error);
    toast.error('Failed to load files from API: ' + error.message);
  }
}

export async function importChatFromFiles({
  importChat,
  fileArtifacts,
  skippedFiles,
  folderName,
}: {
  fileArtifacts: FileContent[];
  importChat: (description: string, messages: Message[]) => Promise<void>;
  folderName: string;
  skippedFiles?: string[];
}) {
  const commands = await detectProjectCommands(fileArtifacts);
  const commandsMessage = createCommandsMessage(commands);

  const filesMessage = buildChatMessage(fileArtifacts, skippedFiles || [], folderName);
  const messages: Message[] = [filesMessage];

  if (commandsMessage) {
    messages.push(commandsMessage);
  }

  await importChat(folderName, messages);
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
