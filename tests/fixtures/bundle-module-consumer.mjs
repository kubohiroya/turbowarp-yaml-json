import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {TextEncoder} from 'node:util';
import {runInNewContext} from 'node:vm';
for (const name of ['Scratch', 'window', 'document']) {
  Object.defineProperty(globalThis, name, {get() {throw new Error('Unexpected global: ' + name);}});
}
globalThis.STRUCTURED_DATA_MVP = true; globalThis.NAMED_DATA_REGISTRY_MVP = true;
const module = await import('@kubohiroya/turbowarp-yaml-json/bundle-module');
assert.equal(module.bundleModuleMetadata.formatVersion, 1);
assert.ok(Object.isFrozen(module.bundleModuleMetadata));
function makeHost(label = '') {
  const registrations = [], cleanups = [], listeners = new Map();
  const registerEditor = () => {const cleanup = {count: 0}; cleanups.push(cleanup); return () => {cleanup.count++;};};
  const port = {calls: [], async createScene() {}, createNode(...args) {this.calls.push(args);}, addClass() {}, setData() {}, setAttribute() {}};
  const scratch = {
    extensions: {unsandboxed: true, register: instance => registrations.push(instance)},
    BlockType: {COMMAND: 'command', REPORTER: 'reporter', BOOLEAN: 'boolean', HAT: 'hat', LOOP: 'loop'},
    ArgumentType: {STRING: 'string', NUMBER: 'number', BOOLEAN: 'boolean'},
    Cast: {toString: String, toNumber: Number, toBoolean: Boolean},
    translate: message => label + (typeof message === 'string' ? message : message.default),
    gui: {blockEditors: {apiVersion: 1, registerSourceEditor: registerEditor, registerFixedInputEditor: registerEditor}},
    vm: {runtime: {turbowarpAFrameCapability: port, on(event, listener) {
      if (!listeners.has(event)) listeners.set(event, new Set()); listeners.get(event).add(listener);
    }, off(event, listener) {listeners.get(event)?.delete(listener);}}}
  };
  return {scratch, registrations, cleanups, listeners, port};
}

const first = makeHost('a:'), second = makeHost('b:');
const a = module.createExtension(first.scratch), b = module.createExtension(second.scratch);
assert.equal(first.registrations.length, 0); assert.equal(second.registrations.length, 0);
assert.ok(a.getInfo().name.startsWith('a:')); assert.ok(b.getInfo().name.startsWith('b:'));

const fragment = a.map({ENTRIES: a.pair({KEY: 'key', VALUE: a.number({VALUE: 1})})});
assert.equal(a.renderJson({FRAGMENT: fragment}), '{\n  "key": 1\n}\n');
assert.equal(a.isValidSchema({SCHEMA: '{"type":"object"}', FRAGMENT: fragment}), true);
const value = b.parseText({TEXT: 'key: 2', FORMAT: 'yaml'});
assert.equal(b.renderJson({FRAGMENT: value}), '{\n  "key": 2\n}\n');
a.parseText({TEXT: 'base: &x [1]\ncopy: *x', FORMAT: 'yaml'});
assert.equal(a.lastParseSucceeded(), false); assert.equal(b.lastParseSucceeded(), true);

await a.dispose(); await a.dispose();
assert.ok(first.cleanups.every(x => x.count === 1));
assert.ok(second.cleanups.every(x => x.count === 0));
await b.dispose();
assert.ok(second.cleanups.every(x => x.count === 1));
const expectedHost = makeHost(), actualHost = makeHost();
const expected = module.createExtension(expectedHost.scratch);
const require = createRequire(import.meta.url);
const source = readFileSync(require.resolve('@kubohiroya/turbowarp-yaml-json/extension'), 'utf8');
runInNewContext(source, {Scratch: actualHost.scratch, TextEncoder, STRUCTURED_DATA_MVP: true, NAMED_DATA_REGISTRY_MVP: true});
assert.equal(actualHost.registrations.length, 1);
assert.equal(JSON.stringify(actualHost.registrations[0].getInfo()), JSON.stringify(expected.getInfo()));
await expected.dispose(); await actualHost.registrations[0].dispose();
