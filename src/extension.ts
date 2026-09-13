import {extensionConfig} from './config';
import definitions from './block-definitions.json';
import {
  booleanValue,
  concat,
  formatValidationResult,
  map,
  nullValue,
  numberValue,
  pair,
  parseData,
  renderJson,
  renderYaml,
  sequence,
  stringValue,
  validateWithJsonSchema,
  type DataFragment,
  type ParseDiagnostic,
  type ParseFormat,
  type ResolvedParseFormat
} from './yaml-json';

type BlockTypeName = 'REPORTER' | 'BOOLEAN';
type ArgumentTypeName = 'STRING' | 'NUMBER' | 'BOOLEAN';

interface DefinitionArgument {
  type: ArgumentTypeName;
  defaultValue: string | number | boolean;
  menu?: string;
}

interface BlockDefinition {
  opcode: string;
  blockType: BlockTypeName;
  text: string;
  description: string;
  arguments: Record<string, DefinitionArgument>;
}

interface MenuDefinition {
  acceptReporters: boolean;
  items: string[];
}

interface LastParseState {
  success: boolean;
  format: ResolvedParseFormat | '';
  diagnostic: ParseDiagnostic | null;
}

const SERIALIZED_PREFIX = 'turbowarp-yaml-json:v1:';
const blockDefinitions = definitions.blocks as readonly BlockDefinition[];
const menuDefinitions = definitions.menus as Record<string, MenuDefinition>;

export class YamlJsonExtension implements TurboWarpExtension {
  private lastParse: LastParseState = {
    success: false,
    format: '',
    diagnostic: null
  };

  public getInfo(): Record<string, unknown> {
    return {
      id: extensionConfig.id,
      name: Scratch.translate(definitions.extensionName),
      docsURI: extensionConfig.docsURI,
      blockIconURI: extensionConfig.blockIconURI,
      blocks: blockDefinitions.map((block) => this.toScratchBlock(block)),
      menus: Object.fromEntries(
        Object.entries(menuDefinitions).map(([id, menu]) => [
          id,
          {
            acceptReporters: menu.acceptReporters,
            items: menu.items.map((item) => Scratch.translate(item))
          }
        ])
      )
    };
  }

  public string(args: {VALUE: unknown}): string {
    return encode(stringValue(Scratch.Cast.toString(args.VALUE)));
  }

  public number(args: {VALUE: unknown}): string {
    return encode(numberValue(Scratch.Cast.toNumber(args.VALUE)));
  }

  public boolean(args: {VALUE: unknown}): string {
    return encode(booleanValue(Scratch.Cast.toBoolean(args.VALUE)));
  }

  public nullValue(): string {
    return encode(nullValue());
  }

  public pair(args: {KEY: unknown; VALUE: unknown}): string {
    return encode(pair(Scratch.Cast.toString(args.KEY), decodeOrString(args.VALUE)));
  }

  public map(args: {ENTRIES: unknown}): string {
    return encode(map(decodeOrString(args.ENTRIES, true)));
  }

  public sequence(args: {ITEMS: unknown}): string {
    return encode(sequence(decodeOrString(args.ITEMS, true)));
  }

  public concat(args: {LEFT: unknown; RIGHT: unknown}): string {
    return encode(concat(decodeOrString(args.LEFT, true), decodeOrString(args.RIGHT, true)));
  }

  public renderYaml(args: {FRAGMENT: unknown}): string {
    return renderYaml(decodeOrString(args.FRAGMENT, true));
  }

  public renderJson(args: {FRAGMENT: unknown}): string {
    return renderJson(decodeOrString(args.FRAGMENT, true));
  }

  public validateSchema(args: {SCHEMA: unknown; FRAGMENT: unknown}): string {
    return formatValidationResult(
      validateWithJsonSchema(
        Scratch.Cast.toString(args.SCHEMA),
        decodeOrString(args.FRAGMENT, true)
      )
    );
  }

  public isValidSchema(args: {SCHEMA: unknown; FRAGMENT: unknown}): boolean {
    return validateWithJsonSchema(
      Scratch.Cast.toString(args.SCHEMA),
      decodeOrString(args.FRAGMENT, true)
    ).valid;
  }

  public parseText(args: {TEXT: unknown; FORMAT: unknown}): string {
    const result = parseData(
      Scratch.Cast.toString(args.TEXT),
      normalizeParseFormat(Scratch.Cast.toString(args.FORMAT))
    );
    this.lastParse = {
      success: result.success,
      format: result.format,
      diagnostic: result.diagnostic
    };
    return result.success ? encode(result.fragment) : '';
  }

  public lastParseSucceeded(): boolean {
    return this.lastParse.success;
  }

  public lastParseFormat(): string {
    return this.lastParse.format;
  }

  public lastParseDiagnostic(): string {
    const diagnostic = this.lastParse.diagnostic;
    if (diagnostic === null) return '';
    const location =
      diagnostic.line > 0 ? ` at line ${diagnostic.line}, column ${diagnostic.column}` : '';
    return `[${diagnostic.code}]${location}: ${diagnostic.message}`;
  }

  public lastParseLine(): number {
    return this.lastParse.diagnostic?.line ?? 0;
  }

  public lastParseColumn(): number {
    return this.lastParse.diagnostic?.column ?? 0;
  }

  private toScratchBlock(block: BlockDefinition): Record<string, unknown> {
    return {
      opcode: block.opcode,
      blockType: Scratch.BlockType[block.blockType],
      text: Scratch.translate(block.text),
      arguments: Object.fromEntries(
        Object.entries(block.arguments).map(([name, argument]) => [
          name,
          {
            type: Scratch.ArgumentType[argument.type],
            defaultValue: argument.defaultValue,
            ...(argument.menu === undefined ? {} : {menu: argument.menu})
          }
        ])
      )
    };
  }
}

function normalizeParseFormat(value: string): ParseFormat {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'json' || normalized === 'yaml') return normalized;
  return 'auto';
}

function encode(fragment: DataFragment): string {
  return `${SERIALIZED_PREFIX}${JSON.stringify(fragment)}`;
}

function decodeOrString(value: unknown, blankAsEmpty = false): DataFragment {
  const raw = Scratch.Cast.toString(value);
  if (blankAsEmpty && raw.length === 0) return {kind: 'empty'};
  if (!raw.startsWith(SERIALIZED_PREFIX)) return stringValue(raw);
  return parseFragment(raw.slice(SERIALIZED_PREFIX.length));
}

function parseFragment(json: string): DataFragment {
  const parsed = JSON.parse(json) as DataFragment;
  if (!isFragment(parsed)) throw new TypeError('Invalid serialized YAML/JSON fragment.');
  return parsed;
}

function isFragment(value: unknown): value is DataFragment {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  if (record.kind === 'empty') return true;
  if (record.kind === 'scalar') return isScalarValue(record.value);
  if (record.kind === 'pair') {
    return typeof record.key === 'string' && isFragment(record.value);
  }
  if (record.kind === 'map') {
    return Array.isArray(record.entries) && record.entries.every(isPairFragment);
  }
  if (record.kind === 'sequence') {
    return Array.isArray(record.items) && record.items.every(isFragment);
  }
  if (record.kind === 'concat')
    return Array.isArray(record.children) && record.children.every(isFragment);
  return false;
}

function isPairFragment(value: unknown): value is DataFragment {
  return isFragment(value) && value.kind === 'pair';
}

function isScalarValue(value: unknown): value is string | number | boolean | null {
  return (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value))
  );
}
