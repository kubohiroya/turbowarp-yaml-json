import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {YamlJsonExtension} from '../src/extension.js';

beforeEach(() => {
  vi.stubGlobal('Scratch', {
    BlockType: {REPORTER: 'reporter', BOOLEAN: 'boolean'},
    ArgumentType: {STRING: 'string', NUMBER: 'number', BOOLEAN: 'boolean'},
    Cast: {
      toString: (value: unknown) => String(value),
      toNumber: (value: unknown) => Number(value),
      toBoolean: (value: unknown) => Boolean(value)
    },
    translate: (
      message: string | {default: string},
      placeholders: Record<string, string | number> = {}
    ) => {
      const value = typeof message === 'string' ? message : message.default;
      return Object.entries(placeholders).reduce(
        (result, [name, replacement]) => result.replace(`{${name}}`, String(replacement)),
        value
      );
    }
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('YamlJsonExtension', () => {
  it('publishes block metadata', () => {
    const info = new YamlJsonExtension().getInfo() as {
      name: string;
      blocks: Array<{opcode: string}>;
    };
    expect(info.name).toBe('TurboWarp YAML/JSON');
    expect(info.blocks.map((block) => block.opcode)).toContain('renderYaml');
    expect(info.blocks.map((block) => block.opcode)).toContain('renderJson');
    expect(info.blocks.map((block) => block.opcode)).toContain('validateSchema');
  });

  it('builds and renders YAML/JSON through reporter values', () => {
    const extension = new YamlJsonExtension();
    const readings = extension.sequence({
      ITEMS: extension.concat({
        LEFT: extension.number({VALUE: 21}),
        RIGHT: extension.number({VALUE: 22})
      })
    });
    const document = extension.map({
      ENTRIES: extension.concat({
        LEFT: extension.pair({KEY: 'name', VALUE: extension.string({VALUE: 'sensor'})}),
        RIGHT: extension.pair({KEY: 'readings', VALUE: readings})
      })
    });

    expect(extension.renderYaml({FRAGMENT: document})).toBe('name: "sensor"\nreadings:\n  - 21\n  - 22');
    expect(extension.renderJson({FRAGMENT: document})).toContain('"readings"');
  });

  it('validates reporter values with JSON Schema', () => {
    const extension = new YamlJsonExtension();
    const schema = JSON.stringify({
      type: 'object',
      required: ['temperature'],
      properties: {temperature: {type: 'number'}}
    });
    const document = extension.map({
      ENTRIES: extension.pair({KEY: 'temperature', VALUE: extension.number({VALUE: 21})})
    });

    expect(extension.isValidSchema({SCHEMA: schema, FRAGMENT: document})).toBe(true);
    expect(extension.validateSchema({SCHEMA: schema, FRAGMENT: document})).toBe('valid');
  });

  it('treats empty container defaults as empty fragments', () => {
    const extension = new YamlJsonExtension();
    expect(extension.renderYaml({FRAGMENT: extension.map({ENTRIES: ''})})).toBe('{}');
    expect(extension.renderYaml({FRAGMENT: extension.sequence({ITEMS: ''})})).toBe('[]');
    expect(extension.renderYaml({FRAGMENT: extension.concat({LEFT: '', RIGHT: ''})})).toBe('null');
  });
});
