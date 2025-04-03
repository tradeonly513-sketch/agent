import { json } from '@remix-run/cloudflare';
import type { ActionFunctionArgs } from '@remix-run/cloudflare';
import fs from 'node:fs/promises';
import { path } from '~/utils/path';
import type { FileContent } from '~/utils/projectCommands';

interface UpdateFileRequest {
  filePath: string;
  content: string;
  dataAppId: string;
}

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const body = (await request.json()) as UpdateFileRequest;
    const { filePath, content, dataAppId } = body;

    const relativePath = filePath.replace('/home/project/', '');

    if (!filePath || !content || !dataAppId) {
      return json({ error: 'Missing required fields' }, { status: 400 });
    }

    const rootDir = path.join(process.cwd(), 'data', dataAppId);
    const appDataPath = path.join(rootDir, 'app-data.json');
    const latestDataPath = path.join(rootDir, 'latest-data.json');

    // Read existing app data
    let appData;

    try {
      const appDataContent = await fs.readFile(appDataPath, 'utf8');
      appData = JSON.parse(appDataContent);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      // If file doesn't exist or is invalid, create new data structure

      await fs.mkdir(rootDir, { recursive: true });
      appData = {
        dataAppId,
        folderName: 'default',
        files: [],
      };
    }

    const fileIndex = appData.files.findIndex((file: FileContent) => file.path === relativePath);

    if (fileIndex >= 0) {
      appData.files[fileIndex].content = content;
    } else {
      appData.files.push({ path: relativePath, content });
    }

    console.log(latestDataPath, JSON.stringify(appData, null, 2));

    await fs.writeFile(latestDataPath, JSON.stringify(appData, null, 2), 'utf8');

    return json({ success: true });
  } catch (error) {
    console.error('Error updating file:', error);
    return json({ error: 'Failed to update file' }, { status: 500 });
  }
};
