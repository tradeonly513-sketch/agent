import { existsSync, rmSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

const dirsToRemove = ['node_modules/.vite', 'node_modules/.cache', '.cache', 'dist'];

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const shouldInstall = !args.has('--no-install') && !dryRun;
const shouldCleanCache = !args.has('--no-cache') && !dryRun;
const shouldBuild = !args.has('--no-build') && !dryRun;

const stepPrefix = dryRun ? '→' : '✓';

console.log('🧹 Cleaning project...');

function removeDir(target) {
  const fullPath = join(projectRoot, target);

  if (!existsSync(fullPath)) {
    console.log(`${stepPrefix} ${target} not found, skipping.`);
    return;
  }

  if (dryRun) {
    console.log(`${stepPrefix} Would remove ${target}`);
    return;
  }

  try {
    rmSync(fullPath, { recursive: true, force: true });
    console.log(`${stepPrefix} Removed ${target}`);
  } catch (error) {
    console.error(`❌ Failed to remove ${target}: ${error.message}`);
    throw error;
  }
}

function runCommand(command, description) {
  console.log(description);

  if (dryRun) {
    console.log(`${stepPrefix} Would run: ${command}`);
    return;
  }

  try {
    execSync(command, { stdio: 'inherit' });
  } catch (error) {
    console.error(`❌ ${description} failed.`);
    throw error;
  }
}

try {
  dirsToRemove.forEach(removeDir);

  if (shouldInstall) {
    runCommand('pnpm install', '\n📦 Reinstalling dependencies...');
  } else if (dryRun) {
    console.log(`${stepPrefix} Would reinstall dependencies`);
  } else {
    console.log('⏭️  Skipping dependency install (--no-install).');
  }

  if (shouldCleanCache) {
    runCommand('pnpm cache clean', '\n🗑️  Clearing pnpm cache...');
  } else if (dryRun) {
    console.log(`${stepPrefix} Would clear pnpm cache`);
  } else {
    console.log('⏭️  Skipping pnpm cache clean (--no-cache).');
  }

  if (shouldBuild) {
    runCommand('pnpm build', '\n🏗️  Rebuilding project...');
  } else if (dryRun) {
    console.log(`${stepPrefix} Would rebuild project`);
  } else {
    console.log('⏭️  Skipping build (--no-build).');
  }

  console.log('\n✨ Clean completed! You can now run pnpm dev');
} catch (error) {
  if (dryRun) {
    console.error('\n❌ Dry run detected an error.');
  } else {
    console.error(`\n❌ Error during cleanup: ${error.message}`);
  }
  process.exit(1);
}
