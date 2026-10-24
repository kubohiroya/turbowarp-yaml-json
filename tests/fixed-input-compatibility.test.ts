import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {YamlJsonExtension} from '../src/extension.js';
import {fixedInputEditors} from '../src/fixed-input-editors.js';
import baseline from './fixtures/stage3-fixed-getinfo.json' with {type: 'json'};
const translate = (message: string | {default: string}) => typeof message === 'string' ? message : message.default;
beforeEach(() => vi.stubGlobal('Scratch', {
  translate, Cast: {toString: (v: unknown) => String(v), toNumber: (v: unknown) => Number(v), toBoolean: (v: unknown) => Boolean(v)},
  BlockType: {COMMAND: 'command', REPORTER: 'reporter', BOOLEAN: 'Boolean', HAT: 'hat'},
  ArgumentType: {STRING: 'string', NUMBER: 'number', BOOLEAN: 'Boolean'},
  vm: {runtime: {on: vi.fn(), off: vi.fn()}}
}));
afterEach(() => vi.unstubAllGlobals());
it('retains the exact baseline getInfo with the legacy host capability', () => {
  const owner = new YamlJsonExtension(Scratch);
  expect(owner.getInfo()).toEqual(baseline.find(s => s.id === 'native-default')!.getInfo);
  void owner.dispose();
});
it('registers only the real visible opcodes once and disposes its own registrations', () => {
  const cleanup = vi.fn();const register = vi.fn(() => cleanup);
  (globalThis as unknown as {Scratch: {gui: unknown}}).Scratch.gui = {blockEditors: {apiVersion: 1, registerFixedInputEditor: register}};
  const owner = new YamlJsonExtension(Scratch);
  const info = owner.getInfo();owner.getInfo();
  const expected = baseline.find(s => s.id === "native-default")!.getInfo;
  expect(info).toEqual(expected);
  expect(register).toHaveBeenCalledTimes(fixedInputEditors.length);
  const visible = ((info as {id: string; blocks: {opcode?: string}[]}).blocks).flatMap(b => b.opcode ? [`${(info as {id: string}).id}_${b.opcode}`] : []);
  for (const [options] of register.mock.calls as unknown as [{opcodes: string[]}][]) expect(options.opcodes.every(op => visible.includes(op))).toBe(true);
  void owner.dispose();void owner.dispose();expect(cleanup).toHaveBeenCalledTimes(fixedInputEditors.length);
});
it('retains parse aliases and excludes the Boolean reporter argument', () => {
  expect(fixedInputEditors.flatMap(o => [...o.opcodes]).some(op => op.endsWith('_boolean'))).toBe(false);
  const format = fixedInputEditors.find(o => o.opcodes.some(op => op.endsWith('_parseText')))!.bindings[0]!;
  for (const [raw, expected] of [[' json ', 'JSON'], [' yAmL ', 'YAML'], [' AUTO ', 'auto']]) expect(format.read(raw!)).toBe(expected);
});

it('constructs with an explicit host before global Scratch is installed', () => {
  const host = Scratch;
  vi.unstubAllGlobals();expect(() => new YamlJsonExtension(host)).not.toThrow();
});
