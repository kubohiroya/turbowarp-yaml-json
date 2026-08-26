import {execFile} from 'node:child_process';
import {access} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';

const execFileAsync = promisify(execFile);
const repositoryRoot = fileURLToPath(new URL('..', import.meta.url));
const hasHead = await gitCommandSucceeds(['rev-parse', '--verify', 'HEAD']);

if (!hasHead) {
  await access(new URL('../dist/extension-manifest.json', import.meta.url));
  await access(new URL('../dist/turbowarp-yaml-json.js', import.meta.url));
  process.stdout.write('Generated dist files exist for initial repository import.\n');
  process.exit(0);
}

const {stdout} = await execFileAsync(
  'git',
  ['status', '--short', '--untracked-files=all', '--', 'dist'],
  {cwd: repositoryRoot}
);

if (stdout.length > 0) {
  process.stderr.write('Generated dist files are not up to date:\n');
  process.stderr.write(stdout);
  process.exitCode = 1;
}

async function gitCommandSucceeds(args) {
  try {
    await execFileAsync('git', args, {cwd: repositoryRoot});
    return true;
  } catch {
    return false;
  }
}
