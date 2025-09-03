import { useSearchParams } from '@remix-run/react';
import { generateId, type Message } from 'ai';
import ignore from 'ignore';
import { useEffect, useState } from 'react';
import { ClientOnly } from 'remix-utils/client-only';
import { BaseChat } from '~/components/chat/BaseChat';
import { Chat } from '~/components/chat/Chat.client';
import { useGit } from '~/lib/hooks/useGit';
import { useChatHistory } from '~/lib/persistence';
import { createCommandsMessage, detectProjectCommands, escapeBoltTags } from '~/utils/projectCommands';
import { LoadingOverlay } from '~/components/ui/LoadingOverlay';
import { toast } from 'react-toastify';

// Binary file extensions that should be handled as binary data
const BINARY_FILE_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.bmp',
  '.webp',
  '.svg',
  '.ico',
  '.tiff',
  '.pdf',
  '.zip',
  '.tar',
  '.gz',
  '.7z',
  '.rar',
  '.mp3',
  '.mp4',
  '.wav',
  '.avi',
  '.mov',
  '.ttf',
  '.otf',
  '.woff',
  '.woff2',
  '.eot',
  '.exe',
  '.dll',
  '.so',
  '.dylib',
  '.bin',
  '.dat',
  '.db',
  '.sqlite',
];

const isBinaryFile = (filePath: string): boolean => {
  const extension = filePath.toLowerCase().substring(filePath.lastIndexOf('.'));
  return BINARY_FILE_EXTENSIONS.includes(extension);
};

const IGNORE_PATTERNS = [
  'node_modules/**',
  '.git/**',
  '.github/**',
  '.vscode/**',
  'dist/**',
  'build/**',
  '.next/**',
  'coverage/**',
  '.cache/**',
  '.vscode/**',
  '.idea/**',
  '**/*.log',
  '**/.DS_Store',
  '**/npm-debug.log*',
  '**/yarn-debug.log*',
  '**/yarn-error.log*',

  // Include this so npm install runs much faster '**/*lock.json',
  '**/*lock.yaml',
];

export function GitUrlImport() {
  const [searchParams] = useSearchParams();
  const { ready: historyReady, importChat } = useChatHistory();
  const { ready: gitReady, gitClone } = useGit();
  const [imported, setImported] = useState(false);
  const [loading, setLoading] = useState(true);

  const importRepo = async (repoUrl?: string) => {
    if (!gitReady && !historyReady) {
      return;
    }

    if (repoUrl) {
      const ig = ignore().add(IGNORE_PATTERNS);

      try {
        const { workdir, data } = await gitClone(repoUrl);

        if (importChat) {
          const filePaths = Object.keys(data).filter((filePath) => !ig.ignores(filePath));
          const textDecoder = new TextDecoder('utf-8');

          const fileContents = filePaths
            .map((filePath) => {
              const { data: content, encoding } = data[filePath];
              const isBinary = isBinaryFile(filePath);

              if (isBinary && content instanceof Uint8Array) {
                // Convert binary data to base64 without stack overflow
                let binary = '';
                const chunkSize = 0x8000; // 32KB chunks

                for (let i = 0; i < content.length; i += chunkSize) {
                  const chunk = content.subarray(i, i + chunkSize);
                  binary += String.fromCharCode.apply(null, Array.from(chunk));
                }

                const base64 = btoa(binary);

                return {
                  path: filePath,
                  content: base64,
                  isBinary: true,
                };
              } else if (encoding === 'utf8') {
                // Handle UTF-8 text content
                return {
                  path: filePath,
                  content: content as string,
                  isBinary: false,
                };
              } else if (content instanceof Uint8Array) {
                // Try to decode as text, fallback to base64 if it fails
                try {
                  const decodedText = textDecoder.decode(content);
                  return {
                    path: filePath,
                    content: decodedText,
                    isBinary: false,
                  };
                } catch {
                  // If decoding fails, treat as binary - convert to base64 without stack overflow
                  let binary = '';
                  const chunkSize = 0x8000; // 32KB chunks

                  for (let i = 0; i < content.length; i += chunkSize) {
                    const chunk = content.subarray(i, i + chunkSize);
                    binary += String.fromCharCode.apply(null, Array.from(chunk));
                  }

                  const base64 = btoa(binary);

                  return {
                    path: filePath,
                    content: base64,
                    isBinary: true,
                  };
                }
              }

              return null;
            })
            .filter((f): f is NonNullable<typeof f> => f !== null && !!f.content);

          const textFiles = fileContents.filter((f) => !f.isBinary);
          const binaryFiles = fileContents.filter((f) => f.isBinary);

          const commands = await detectProjectCommands(textFiles);
          const commandsMessage = createCommandsMessage(commands);

          const importSummary =
            binaryFiles.length > 0 && textFiles.length > 0
              ? ` (${textFiles.length} text, ${binaryFiles.length} binary files)`
              : binaryFiles.length > 0
                ? ` (${binaryFiles.length} binary files)`
                : ` (${textFiles.length} text files)`;

          const filesMessage: Message = {
            role: 'assistant',
            content: `Cloning the repo ${repoUrl} into ${workdir}${importSummary}
<boltArtifact id="imported-files" title="Git Cloned Files"  type="bundled">
${fileContents
  .map(
    (file) =>
      `<boltAction type="file" filePath="${file.path}"${file.isBinary ? ' encoding="base64"' : ''}>
${file.isBinary ? file.content : escapeBoltTags(file.content)}
</boltAction>`,
  )
  .join('\n')}
</boltArtifact>`,
            id: generateId(),
            createdAt: new Date(),
          };

          const messages = [filesMessage];

          if (commandsMessage) {
            messages.push({
              role: 'user',
              id: generateId(),
              content: 'Setup the codebase and Start the application',
            });
            messages.push(commandsMessage);
          }

          await importChat(`Git Project:${repoUrl.split('/').slice(-1)[0]}`, messages, { gitUrl: repoUrl });
        }
      } catch (error) {
        console.error('Error during import:', error);
        toast.error('Failed to import repository');
        setLoading(false);
        window.location.href = '/';

        return;
      }
    }
  };

  useEffect(() => {
    if (!historyReady || !gitReady || imported) {
      return;
    }

    const url = searchParams.get('url');

    if (!url) {
      window.location.href = '/';
      return;
    }

    importRepo(url).catch((error) => {
      console.error('Error importing repo:', error);
      toast.error('Failed to import repository');
      setLoading(false);
      window.location.href = '/';
    });
    setImported(true);
  }, [searchParams, historyReady, gitReady, imported]);

  return (
    <ClientOnly fallback={<BaseChat />}>
      {() => (
        <>
          <Chat />
          {loading && <LoadingOverlay message="Please wait while we clone the repository..." />}
        </>
      )}
    </ClientOnly>
  );
}
