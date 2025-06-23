import { json } from '@remix-run/cloudflare';
import JSZip from 'jszip';

export async function loader({ request, context }: { request: Request; context?: any }) {
  const url = new URL(request.url);
  const repo = url.searchParams.get('repo');

  if (!repo) {
    return json({ error: 'Repository name is required' }, { status: 400 });
  }

  try {
    const baseUrl = 'https://api.github.com';

    // Get GitHub token from Cloudflare context env or fallback to process.env
    const env = context?.cloudflare?.env || context?.env || process.env || {};
    const githubToken = env.GITHUB_TOKEN;

    console.log(`Processing GitHub template for repo: ${repo}`);

    // Get the latest release
    const releaseResponse = await fetch(`${baseUrl}/repos/${repo}/releases/latest`, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Buildify-App/1.0',
        // Add GitHub token if available
        ...(githubToken ? { Authorization: `Bearer ${githubToken}` } : {}),
      },
    });

    if (!releaseResponse.ok) {
      const errorText = await releaseResponse.text();
      console.error(`GitHub API error for repo ${repo}: ${releaseResponse.status} ${releaseResponse.statusText}`);
      console.error(`Error details: ${errorText}`);
      throw new Error(`GitHub API error: ${releaseResponse.status} - ${errorText}`);
    }

    const releaseData = (await releaseResponse.json()) as any;
    const zipballUrl = releaseData.zipball_url;

    if (!zipballUrl) {
      throw new Error('No zipball URL found in release data');
    }

    console.log(`Fetching zipball from: ${zipballUrl}`);

    // Fetch the zipball
    const zipResponse = await fetch(zipballUrl, {
      headers: {
        'User-Agent': 'Buildify-App/1.0',
        ...(githubToken ? { Authorization: `Bearer ${githubToken}` } : {}),
      },
    });

    if (!zipResponse.ok) {
      const errorText = await zipResponse.text();
      console.error(`Failed to fetch zipball: ${zipResponse.status} ${zipResponse.statusText}`);
      console.error(`Error details: ${errorText}`);
      throw new Error(`Failed to fetch release zipball: ${zipResponse.status} - ${errorText}`);
    }

    // Get the zip content as ArrayBuffer
    const zipArrayBuffer = await zipResponse.arrayBuffer();
    console.log(`Zip ArrayBuffer size: ${zipArrayBuffer.byteLength} bytes`);

    // Use JSZip to extract the contents
    const zip = await JSZip.loadAsync(zipArrayBuffer);
    console.log('JSZip loaded successfully');

    // Find the root folder name
    let rootFolderName = '';
    zip.forEach((relativePath) => {
      if (!rootFolderName && relativePath.includes('/')) {
        rootFolderName = relativePath.split('/')[0];
      }
    });

    // Extract all files
    const promises = Object.keys(zip.files).map(async (filename) => {
      const zipEntry = zip.files[filename];

      // Skip directories
      if (zipEntry.dir) {
        return null;
      }

      // Skip the root folder itself
      if (filename === rootFolderName) {
        return null;
      }

      // Remove the root folder from the path
      let normalizedPath = filename;

      if (rootFolderName && filename.startsWith(rootFolderName + '/')) {
        normalizedPath = filename.substring(rootFolderName.length + 1);
      }

      // Get the file content
      const content = await zipEntry.async('string');

      return {
        name: normalizedPath.split('/').pop() || '',
        path: normalizedPath,
        content,
      };
    });

    const results = await Promise.all(promises);
    const fileList = results.filter(Boolean) as { name: string; path: string; content: string }[];

    console.log(`Successfully extracted ${fileList.length} files from ${repo}`);
    
    return json(fileList);
  } catch (error) {
    console.error('Error processing GitHub template:', error);
    return json({ error: 'Failed to fetch template files' }, { status: 500 });
  }
}
