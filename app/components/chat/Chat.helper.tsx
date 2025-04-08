import type { Message } from 'ai';
import {
  detectProjectCommands,
  createCommandsMessage,
  escapeBoltTags,
  type FileContent,
} from '~/utils/projectCommands';
import { generateId } from '~/utils/fileUtils';
import { workbenchStore } from '~/lib/stores/workbench';

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

export async function saveFilesToServer(files: FileContent[], dataAppId: string, folderName: string) {
  const response = await fetch('/code-editor/api/save-files', {
    method: 'POST',
    body: JSON.stringify({
      files,
      dataAppId,
      folderName,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to save files: ${response.statusText}`);
  }

  const data: { files: FileContent[]; isLatest: boolean } = await response.json();

  return data;
}

export async function saveFileToServer(filePath: string, content: string, dataAppId: string): Promise<void> {
  try {
    const response = await fetch('/code-editor/api/save-file', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filePath,
        dataAppId,
        content,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to save file: ${response.statusText}`);
    }
  } catch (error) {
    console.error('Failed to save file to server:', error);
  }
}

interface ApiResponse {
  fileArtifacts: FileContent[];
  skippedFiles: string[];
  folderName: string;
}

export async function loadFilesFromDataApp(dataAppId: string, token: string) {
  const response = await fetch(`/code-editor/api/get-files?dataAppId=${dataAppId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      token,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to process files: ${response.statusText}`);
  }

  const data = (await response.json()) as ApiResponse;
  const { fileArtifacts, skippedFiles, folderName } = data;

  // Save files to server
  const updatedArtifacts = await saveFilesToServer(fileArtifacts, dataAppId, folderName);
  const messages = await importChatFromFiles({
    fileArtifacts: updatedArtifacts.files,
    skippedFiles,
    folderName,
  });

  return { messages, folderName, updatedArtifacts };
}

export async function importChatFromFiles({
  fileArtifacts,
  skippedFiles,
  folderName,
}: {
  fileArtifacts: FileContent[];
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

  return messages;
}

export async function saveFilesToWorkbench({ fileArtifacts }: { fileArtifacts: FileContent[] }) {
  const fileMaps = fileArtifacts.map((file) => ({
    [`/home/project/${file.path}`]: {
      type: 'file',
      content: file.content,
    },
  }));

  workbenchStore.setDocuments(Object.assign({}, ...fileMaps));
}

export async function publishCodeToServer(
  file: File,
  dataAppId: string,
  projectName: string,
  fileArtifacts: FileContent[],
) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('dataAppId', dataAppId);
  formData.append('projectName', projectName);
  formData.append('fileArtifacts', JSON.stringify(fileArtifacts));

  const response = await fetch('/code-editor/api/publish-code', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = (await response.json()) as { error?: string };
    throw new Error(errorData.error || 'Failed to publish code');
  }

  return await response.json();
}
