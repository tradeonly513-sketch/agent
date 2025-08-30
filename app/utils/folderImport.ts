import type { Message } from 'ai';
import { generateId } from './fileUtils';
import { detectProjectCommands, createCommandsMessage, escapeBoltTags } from './projectCommands';

interface FileArtifact {
  content: string;
  path: string;
  isBinary?: boolean;
}

export const createChatFromFolder = async (
  textFiles: File[],
  binaryFiles: File[],
  folderName: string,
): Promise<Message[]> => {
  // Process text files
  const textArtifacts = await Promise.all(
    textFiles.map(async (file) => {
      return new Promise<FileArtifact>((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => {
          const content = reader.result as string;
          const relativePath = file.webkitRelativePath.split('/').slice(1).join('/');
          resolve({
            content,
            path: relativePath,
            isBinary: false,
          });
        };
        reader.onerror = reject;
        reader.readAsText(file);
      });
    }),
  );

  // Process binary files
  const binaryArtifacts = await Promise.all(
    binaryFiles.map(async (file) => {
      return new Promise<FileArtifact>((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => {
          const arrayBuffer = reader.result as ArrayBuffer;
          const uint8Array = new Uint8Array(arrayBuffer);
          
          // Convert to base64 without using String.fromCharCode.apply to avoid stack overflow
          let binary = '';
          const chunkSize = 0x8000; // 32KB chunks
          for (let i = 0; i < uint8Array.length; i += chunkSize) {
            const chunk = uint8Array.subarray(i, i + chunkSize);
            binary += String.fromCharCode.apply(null, Array.from(chunk));
          }
          const base64 = btoa(binary);
          
          const relativePath = file.webkitRelativePath.split('/').slice(1).join('/');
          resolve({
            content: base64,
            path: relativePath,
            isBinary: true,
          });
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
      });
    }),
  );

  const fileArtifacts = [...textArtifacts, ...binaryArtifacts];

  const commands = await detectProjectCommands(textArtifacts);
  const commandsMessage = createCommandsMessage(commands);

  const binaryFilesCount = binaryFiles.length;
  const textFilesCount = textFiles.length;
  const totalFiles = binaryFilesCount + textFilesCount;

  const importSummary =
    binaryFilesCount > 0 && textFilesCount > 0
      ? `\n\nImported ${totalFiles} files (${textFilesCount} text, ${binaryFilesCount} binary)`
      : binaryFilesCount > 0
        ? `\n\nImported ${binaryFilesCount} binary files`
        : `\n\nImported ${textFilesCount} text files`;

  const filesMessage: Message = {
    role: 'assistant',
    content: `I've imported the contents of the "${folderName}" folder.${importSummary}

<boltArtifact id="imported-files" title="Imported Files" type="bundled" >
${fileArtifacts
  .map(
    (file) => `<boltAction type="file" filePath="${file.path}"${file.isBinary ? ' encoding="base64"' : ''}>
${file.isBinary ? file.content : escapeBoltTags(file.content)}
</boltAction>`,
  )
  .join('\n\n')}
</boltArtifact>`,
    id: generateId(),
    createdAt: new Date(),
  };

  const userMessage: Message = {
    role: 'user',
    id: generateId(),
    content: `Import the "${folderName}" folder`,
    createdAt: new Date(),
  };

  const messages = [userMessage, filesMessage];

  if (commandsMessage) {
    messages.push({
      role: 'user',
      id: generateId(),
      content: 'Setup the codebase and Start the application',
    });
    messages.push(commandsMessage);
  }

  return messages;
};
