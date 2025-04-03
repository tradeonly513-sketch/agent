import { json } from '@remix-run/cloudflare';
import type { ActionFunction } from '@remix-run/cloudflare';
import fs from 'node:fs/promises';
import { path } from '~/utils/path';
import type { FileContent } from '~/utils/projectCommands';

interface SaveFilesRequest {
  files: FileContent[];
  dataAppId: string;
  folderName: string;
}

export const action: ActionFunction = async ({ request }) => {
  try {
    const body = (await request.json()) as SaveFilesRequest;
    const { files, dataAppId, folderName } = body;

    if (!files || !dataAppId || !folderName) {
      return json({ error: 'Missing required fields' }, { status: 400 });
    }

    const rootDir = path.join(process.cwd(), 'data', dataAppId);
    await fs.mkdir(rootDir, { recursive: true });

    const data = {
      dataAppId,
      folderName,
      files,
    };

    await fs.writeFile(path.join(rootDir, 'app-data.json'), JSON.stringify(data, null, 2), 'utf8');

    // Read latest-data.json to get the most recent files
    const latestDataPath = path.join(rootDir, 'latest-data.json');
    let latestFiles = files;

    try {
      const latestDataContent = await fs.readFile(latestDataPath, 'utf8');
      const latestData = JSON.parse(latestDataContent);
      latestFiles = latestData.files;
    } catch (error) {
      console.error('Error reading latest-data.json:', error);
      return json({ success: true, files, isLatest: false });
    }

    return json({ success: true, files: latestFiles, isLatest: true });
  } catch (error) {
    console.error('Error saving files:', error);
    return json({ error: 'Failed to save files' }, { status: 500 });
  }
};
