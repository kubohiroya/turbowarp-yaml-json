import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {copyFile, mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {promisify} from 'node:util';

interface DependencyTree {
  dependencies?: Record<string, DependencyTree>;
}
const run = promisify(execFile);
const root = fileURLToPath(new URL('..', import.meta.url));
const metadata = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const temporary = await mkdtemp(path.join(tmpdir(), 'turbowarp-owner-module-'));
try {
  const {stdout} = await run(
    'npm',
    ['pack', '--ignore-scripts', '--json', '--pack-destination', temporary],
    {cwd: root}
  );
  const [packed] = JSON.parse(stdout) as {filename: string}[];
  assert.ok(packed);
  const dependencies = Object.fromEntries(
    Object.keys(metadata.peerDependencies ?? {}).map((name) => [
      name,
      metadata.devDependencies[name] ?? metadata.peerDependencies[name]
    ])
  );
  await writeFile(
    path.join(temporary, 'package.json'),
    JSON.stringify({private: true, type: 'module', dependencies})
  );
  await run(
    'npm',
    [
      'install',
      path.join(temporary, packed.filename),
      '--omit=dev',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      '--package-lock=false',
      '--cache',
      path.join(temporary, 'cache')
    ],
    {cwd: temporary}
  );
  await copyFile(
    path.join(root, 'tests/fixtures/bundle-module-consumer.mjs'),
    path.join(temporary, 'consumer.mjs')
  );
  await run(process.execPath, ['consumer.mjs'], {cwd: temporary});
  await writeFile(
    path.join(temporary, 'consumer.ts'),
    `
import {createExtension, bundleModuleMetadata, type ScratchApi,
  type TurboWarpExtension, type ExtensionModuleMetadata} from '${metadata.name}/bundle-module';
declare const host: ScratchApi;
const instance: TurboWarpExtension = createExtension(host);
const entry: ExtensionModuleMetadata = bundleModuleMetadata;
const disposal: void | Promise<void> = createExtension(host).dispose();
void [instance, entry, disposal];
// @ts-expect-error Module consumers do not need a global Scratch declaration.
void Scratch;
`
  );
  await run(
    process.execPath,
    [
      path.join(root, 'node_modules/typescript/bin/tsc'),
      '--noEmit',
      '--strict',
      '--module',
      'NodeNext',
      '--moduleResolution',
      'NodeNext',
      '--target',
      'ES2020',
      '--lib',
      'ES2022,DOM,DOM.Iterable',
      'consumer.ts'
    ],
    {cwd: temporary}
  );
  const tree = await run('npm', ['ls', '--omit=dev', '--all', '--json'], {cwd: temporary});
  const forbidden = metadata.name.endsWith('yaml-json')
    ? /^(?:@kubohiroya\/turbowarp-extension-data-editor|@rjsf\/.*|react|react-dom)$/u
    : /^(?:@kubohiroya\/turbowarp-extension-data-editor|ajv(?:-.*)?|@rjsf\/.*|react|react-dom)$/u;
  const packages = new Set<string>();
  function inspect(tree: DependencyTree) {
    for (const [name, dependency] of Object.entries(tree.dependencies ?? {})) {
      assert.ok(!forbidden.test(name), 'Unexpected production editor dependency: ' + name);
      packages.add(name);
      inspect(dependency);
    }
  }
  inspect(JSON.parse(tree.stdout));
  const source = await readFile(
    new URL('../lib-module/src/bundle-module.js', import.meta.url),
    'utf8'
  );
  assert.match(source, /from ['"]yaml['"]/u);
  assert.doesNotMatch(
    source,
    /var Parser = class|var Composer = class|compileSchemaBundle|require_ajv|Ajv2020/u
  );
  process.stdout.write(
    JSON.stringify(
      {
        package: metadata.name,
        packedModuleConsumer: 'passed',
        publicTypes: 'passed',
        runtimeDependenciesExternal: true,
        productionPackages: [...packages].sort()
      },
      null,
      2
    ) + '\n'
  );
} finally {
  await rm(temporary, {recursive: true, force: true});
}
