import { json } from '@remix-run/node';
import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import fs from 'node:fs/promises';
import { path } from '~/utils/path';
import type { FileContent } from '~/utils/projectCommands';
import { ErrorBoundary } from '~/components/ui/ErrorBoundary/ErrorBoundary';

interface SaveFilesRequest {
  files: FileContent[];
  dataAppId: string;
  folderName: string;
}

interface AppData {
  dataAppId: string;
  folderName: string;
  files: FileContent[];
}

function validateDataAppId(dataAppId: string | undefined) {
  if (!dataAppId) {
    return json({ error: 'Data app ID is required' }, { status: 400 });
  }

  return null;
}

async function getDataPath(dataAppId: string) {
  const rootDir = path.join(process.cwd(), 'data', dataAppId);
  return path.join(rootDir, 'app-data.json');
}

async function readAppData(dataPath: string): Promise<AppData> {
  const data = await fs.readFile(dataPath, 'utf8');
  return JSON.parse(data) as AppData;
}

async function writeAppData(dataPath: string, data: AppData) {
  await fs.mkdir(path.dirname(dataPath), { recursive: true });
  await fs.writeFile(dataPath, JSON.stringify(data, null, 2), 'utf8');
}

export async function loader({ params }: LoaderFunctionArgs) {
  const error = validateDataAppId(params.dataAppId);

  if (error) {
    return error;
  }

  try {
    const dataPath = await getDataPath(params.dataAppId!);

    try {
      const data = await readAppData(dataPath);
      return json(data);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return json({ error: 'No saved data found' }, { status: 404 });
      }

      throw error;
    }
  } catch (error) {
    console.error('Error loading files:', error);
    return json({ error: 'Failed to load files' }, { status: 500 });
  }
}

export async function action({ request, params }: ActionFunctionArgs) {
  console.log('dataappid', params.dataAppId);

  const error = validateDataAppId(params.dataAppId);

  if (error) {
    return error;
  }

  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const body = (await request.json()) as SaveFilesRequest;
    const { files, folderName } = body;

    if (!files || !folderName) {
      return json({ error: 'Missing required fields' }, { status: 400 });
    }

    const dataPath = await getDataPath(params.dataAppId!);
    const data: AppData = {
      dataAppId: params.dataAppId!,
      folderName,
      files,
    };

    await writeAppData(dataPath, data);

    return json({ success: true });
  } catch (error) {
    console.error('Error saving files:', error);
    return json({ error: 'Failed to save files' }, { status: 500 });
  }
}

export { ErrorBoundary };
