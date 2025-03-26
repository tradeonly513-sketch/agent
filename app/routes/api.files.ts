import { json } from '@remix-run/node';
import type { ActionFunctionArgs } from '@remix-run/node';
import fs from 'node:fs/promises';
import { path } from '~/utils/path';
import type { FileContent } from '~/utils/projectCommands';

interface SaveFilesRequest {
  files: FileContent[];
  dataAppId: string;
  folderName: string;
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

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

    return json({ success: true });
  } catch (error) {
    console.error('Error saving files:', error);
    return json({ error: 'Failed to save files' }, { status: 500 });
  }
}
