import fs from 'node:fs/promises';
import { path } from '~/utils/path';
import type { FileContent } from '~/utils/projectCommands';

export interface AppData {
  dataAppId: string;
  folderName: string;
  files: FileContent[];
}

/**
 * Get the path to the app data file for a specific data app
 */
export async function getDataPath(dataAppId: string, fileType: 'app' | 'latest' = 'app'): Promise<string> {
  const rootDir = path.join(process.cwd(), 'data', dataAppId);
  const fileName = fileType === 'app' ? 'app-data.json' : 'latest-data.json';

  return path.join(rootDir, fileName);
}

/**
 * Read app data from disk
 */
export async function readAppData(dataPath: string): Promise<AppData> {
  const data = await fs.readFile(dataPath, 'utf8');
  return JSON.parse(data) as AppData;
}

/**
 * Write app data to disk
 */
export async function writeAppData(dataPath: string, data: AppData): Promise<void> {
  await fs.mkdir(path.dirname(dataPath), { recursive: true });
  await fs.writeFile(dataPath, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * Save file artifacts to disk
 */
export async function saveFileArtifacts(
  fileArtifacts: FileContent[],
  dataAppId: string,
  folderName: string,
  fileType: 'app' | 'latest' = 'app',
): Promise<void> {
  const dataPath = await getDataPath(dataAppId, fileType);
  const data: AppData = {
    dataAppId,
    folderName,
    files: fileArtifacts,
  };

  await writeAppData(dataPath, data);
}

/**
 * Read file artifacts from disk
 */
export async function readFileArtifacts(
  dataAppId: string,
  fileType: 'app' | 'latest' = 'app',
): Promise<AppData | null> {
  try {
    const dataPath = await getDataPath(dataAppId, fileType);
    return await readAppData(dataPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }

    throw error;
  }
}

/**
 * Update a single file in the file artifacts
 */
export async function updateFileInArtifacts(
  filePath: string,
  content: string,
  dataAppId: string,
  folderName: string = 'default',
): Promise<void> {
  // Get the relative path
  const relativePath = filePath.replace('/home/project/', '');

  const appDataPath = await getDataPath(dataAppId, 'app');
  let appData: AppData;

  try {
    appData = await readAppData(appDataPath);
  } catch {
    appData = {
      dataAppId,
      folderName,
      files: [],
    };
  }

  // Update or add the file
  const fileIndex = appData.files.findIndex((file) => file.path === relativePath);

  if (fileIndex >= 0) {
    appData.files[fileIndex].content = content;
  } else {
    appData.files.push({ path: relativePath, content });
  }

  // Save to latest-data.json
  await writeAppData(await getDataPath(dataAppId, 'latest'), appData);
}

/**
 * Delete the latest data file for a specific data app
 */
export async function deleteDataFile(dataAppId: string, fileType: 'app' | 'latest' = 'app'): Promise<boolean> {
  try {
    const dataPath = await getDataPath(dataAppId, fileType);

    // Check if file exists before trying to delete it
    try {
      await fs.access(dataPath);

      // File exists, so delete it
      await fs.unlink(dataPath);
    } catch {
      // File doesn't exist, which is fine
    }

    return true;
  } catch (error) {
    console.error('Error deleting data file:', error);
    return false;
  }
}
