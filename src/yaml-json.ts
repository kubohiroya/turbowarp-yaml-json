import Ajv, {type AnySchema, type ErrorObject} from 'ajv';
import {
  parse as parseJsonText,
  printParseErrorCode,
  type ParseError as JsonParseError
} from 'jsonc-parser';
import {
  isAlias,
  isMap,
  isScalar,
  isSeq,
  LineCounter,
  parseDocument,
  type Node as YamlNode,
  type Pair as YamlPair
} from 'yaml';

export type DataScalarValue = string | number | boolean | null;
export type DataValue =
  DataScalarValue | readonly DataValue[] | {readonly [key: string]: DataValue};

export type DataFragment = DataScalar | DataPair | DataMap | DataSequence | DataConcat | DataEmpty;

export interface DataScalar {
  readonly kind: 'scalar';
  readonly value: DataScalarValue;
}

export interface DataPair {
  readonly kind: 'pair';
  readonly key: string;
  readonly value: DataFragment;
}

export interface DataMap {
  readonly kind: 'map';
  readonly entries: readonly DataPair[];
}

export interface DataSequence {
  readonly kind: 'sequence';
  readonly items: readonly DataFragment[];
}

export interface DataConcat {
  readonly kind: 'concat';
  readonly children: readonly DataFragment[];
}

export interface DataEmpty {
  readonly kind: 'empty';
}

export interface SchemaValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

export type ParseFormat = 'auto' | 'json' | 'yaml';
export type ResolvedParseFormat = Exclude<ParseFormat, 'auto'>;

export interface ParseDiagnostic {
  readonly code: string;
  readonly message: string;
  readonly line: number;
  readonly column: number;
}

export type ParseResult =
  | {
      readonly success: true;
      readonly format: ResolvedParseFormat;
      readonly fragment: DataFragment;
      readonly diagnostic: null;
    }
  | {
      readonly success: false;
      readonly format: ResolvedParseFormat;
      readonly fragment: null;
      readonly diagnostic: ParseDiagnostic;
    };

export const PARSE_LIMITS = {
  maxInputBytes: 256 * 1024,
  maxDepth: 64,
  maxNodes: 50_000,
  maxAliases: 0
} as const;

export const empty: DataEmpty = {kind: 'empty'};

const SIMPLE_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_-]*$/u;
const ajv = new Ajv({allErrors: true, strict: false});

export function stringValue(value: string): DataScalar {
  return {kind: 'scalar', value};
}

export function numberValue(value: number): DataScalar {
  return {kind: 'scalar', value: Number.isFinite(value) ? value : 0};
}

export function booleanValue(value: boolean): DataScalar {
  return {kind: 'scalar', value};
}

export function nullValue(): DataScalar {
  return {kind: 'scalar', value: null};
}

export function pair(key: string, value: DataFragment | string): DataPair {
  return {kind: 'pair', key, value: normalizeContent(value)};
}

export function map(entries: DataFragment | string): DataMap {
  return {kind: 'map', entries: normalizeEntries(entries)};
}

export function sequence(items: DataFragment | string): DataSequence {
  return {kind: 'sequence', items: normalizeItems(items)};
}

export function concat(left: DataFragment, right: DataFragment): DataFragment {
  const children = [...flattenConcat(left), ...flattenConcat(right)].filter(
    (child) => child.kind !== 'empty'
  );
  if (children.length === 0) return empty;
  if (children.length === 1) return children[0] ?? empty;
  return {kind: 'concat', children};
}

export function renderYaml(fragment: DataFragment): string {
  return renderYamlValue(toValue(fragment), 0);
}

export function renderJson(fragment: DataFragment): string {
  return `${JSON.stringify(toValue(fragment), null, 2)}\n`;
}

export function toValue(fragment: DataFragment): DataValue {
  switch (fragment.kind) {
    case 'empty':
      return null;
    case 'scalar':
      return fragment.value;
    case 'pair':
      return {[fragment.key]: toValue(fragment.value)};
    case 'map':
      return Object.fromEntries(fragment.entries.map((entry) => [entry.key, toValue(entry.value)]));
    case 'sequence':
      return fragment.items.map(toValue);
    case 'concat':
      return mergeTopLevelValues(fragment.children);
  }
}

export function validateWithJsonSchema(
  schemaJson: string,
  fragment: DataFragment
): SchemaValidationResult {
  let schema: unknown;
  try {
    schema = JSON.parse(schemaJson);
  } catch (error) {
    return {
      valid: false,
      errors: [`Invalid JSON Schema: ${formatErrorMessage(error)}`]
    };
  }

  try {
    const validate = ajv.compile(schema as AnySchema);
    if (validate(toValue(fragment))) return {valid: true, errors: []};
    return {valid: false, errors: formatAjvErrors(validate.errors ?? [])};
  } catch (error) {
    return {
      valid: false,
      errors: [`Invalid JSON Schema: ${formatErrorMessage(error)}`]
    };
  }
}

export function parseData(source: string, format: ParseFormat = 'auto'): ParseResult {
  const selectedFormat = resolveFormat(source, format);
  const inputDiagnostic = validateInputSize(source);
  if (inputDiagnostic !== null) return failure(selectedFormat, inputDiagnostic);

  return selectedFormat === 'json' ? parseJson(source) : parseYaml(source);
}

export function formatValidationResult(result: SchemaValidationResult): string {
  return result.valid ? 'valid' : result.errors.join('\n');
}

export function normalizeContent(content: DataFragment | string): DataFragment {
  return typeof content === 'string' ? stringValue(content) : content;
}

function normalizeEntries(entries: DataFragment | string): readonly DataPair[] {
  const fragment = normalizeContent(entries);
  if (fragment.kind === 'empty') return [];
  if (fragment.kind === 'map') return fragment.entries;
  const children = flattenConcat(fragment);
  if (children.every((child): child is DataPair => child.kind === 'pair')) return children;
  throw new TypeError('Map entries must be pair fragments.');
}

function normalizeItems(items: DataFragment | string): readonly DataFragment[] {
  const fragment = normalizeContent(items);
  if (fragment.kind === 'empty') return [];
  if (fragment.kind === 'concat') return fragment.children;
  return [fragment];
}

function flattenConcat(fragment: DataFragment): readonly DataFragment[] {
  if (fragment.kind === 'concat') return fragment.children.flatMap(flattenConcat);
  return [fragment];
}

function mergeTopLevelValues(children: readonly DataFragment[]): DataValue {
  const values = children.filter((child) => child.kind !== 'empty').map(toValue);
  if (values.length === 0) return null;
  if (values.every(isPlainObject)) return Object.assign({}, ...values) as DataValue;
  return values;
}

function renderYamlValue(value: DataValue, indent: number): string {
  if (isPlainObject(value)) {
    const entries = Object.entries(value);
    if (entries.length === 0) return `${spaces(indent)}{}`;
    return entries.map(([key, entryValue]) => renderValuePair(key, entryValue, indent)).join('\n');
  }
  if (isDataArray(value)) {
    if (value.length === 0) return `${spaces(indent)}[]`;
    return value.map((item) => renderSequenceItem(item, indent)).join('\n');
  }
  return `${spaces(indent)}${renderScalar(value)}`;
}

function renderValuePair(key: string, value: DataValue, indent: number): string {
  const prefix = `${spaces(indent)}${renderKey(key)}:`;
  if (!isPlainObject(value) && !isDataArray(value)) return `${prefix} ${renderScalar(value)}`;
  return `${prefix}\n${renderYamlValue(value, indent + 2)}`;
}

function renderSequenceItem(item: DataValue, indent: number): string {
  const prefix = `${spaces(indent)}-`;
  if (!isPlainObject(item) && !isDataArray(item)) return `${prefix} ${renderScalar(item)}`;
  return `${prefix}\n${renderYamlValue(item, indent + 2)}`;
}

function renderKey(key: string): string {
  return SIMPLE_KEY_PATTERN.test(key) ? key : JSON.stringify(key);
}

function renderScalar(value: DataScalarValue): string {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);
  return JSON.stringify(value);
}

function formatAjvErrors(errors: readonly ErrorObject[]): readonly string[] {
  if (errors.length === 0) return ['JSON Schema validation failed.'];
  return errors.map((error) => {
    const path = error.instancePath.length > 0 ? error.instancePath : '$';
    return `${path} ${error.message ?? 'is invalid'}`;
  });
}

function formatErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function parseJson(source: string): ParseResult {
  const errors: JsonParseError[] = [];
  const value = parseJsonText(source, errors, {
    allowEmptyContent: false,
    allowTrailingComma: false,
    disallowComments: true
  }) as unknown;
  const syntaxError = errors[0];
  if (syntaxError !== undefined) {
    return failure('json', {
      code: 'INVALID_JSON',
      message: printParseErrorCode(syntaxError.error),
      ...positionAt(source, syntaxError.offset)
    });
  }
  try {
    return {
      success: true,
      format: 'json',
      fragment: fragmentFromUnknown(value, {nodes: 0}, 0),
      diagnostic: null
    };
  } catch (error) {
    if (error instanceof ParseLimitError) return failure('json', error.diagnostic);
    return failure('json', {
      code: 'INVALID_JSON_VALUE',
      message: formatErrorMessage(error),
      line: 0,
      column: 0
    });
  }
}

function parseYaml(source: string): ParseResult {
  const lineCounter = new LineCounter();
  const document = parseDocument(source, {
    lineCounter,
    prettyErrors: false,
    schema: 'core',
    uniqueKeys: true
  });
  const error = document.errors[0];
  if (error !== undefined) {
    const offset = error.pos[0];
    return failure('yaml', {
      code: error.code,
      message: error.message,
      ...yamlPosition(lineCounter, offset)
    });
  }
  const warning = document.warnings[0];
  if (warning !== undefined) {
    return failure('yaml', {
      code: warning.code,
      message: warning.message,
      ...yamlPosition(lineCounter, warning.pos[0])
    });
  }

  try {
    return {
      success: true,
      format: 'yaml',
      fragment: fragmentFromYamlNode(document.contents, {nodes: 0}, 0, lineCounter),
      diagnostic: null
    };
  } catch (caught) {
    if (caught instanceof ParseLimitError) return failure('yaml', caught.diagnostic);
    return failure('yaml', {
      code: 'INVALID_YAML_VALUE',
      message: formatErrorMessage(caught),
      line: 0,
      column: 0
    });
  }
}

interface ParseBudget {
  nodes: number;
}

function fragmentFromUnknown(value: unknown, budget: ParseBudget, depth: number): DataFragment {
  consumeBudget(budget, depth);
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return {kind: 'scalar', value};
  }
  if (typeof value === 'number' && Number.isFinite(value)) return {kind: 'scalar', value};
  if (Array.isArray(value)) {
    return {
      kind: 'sequence',
      items: value.map((item) => fragmentFromUnknown(item, budget, depth + 1))
    };
  }
  if (typeof value === 'object') {
    return {
      kind: 'map',
      entries: Object.entries(value).map(([key, item]) => ({
        kind: 'pair',
        key,
        value: fragmentFromUnknown(item, budget, depth + 1)
      }))
    };
  }
  throw new TypeError('Parsed data contains an unsupported value.');
}

function fragmentFromYamlNode(
  node: YamlNode<unknown> | null | unknown,
  budget: ParseBudget,
  depth: number,
  lineCounter: LineCounter
): DataFragment {
  consumeBudget(budget, depth, nodePosition(node, lineCounter));
  if (node === null) return nullValue();
  if (isAlias(node)) {
    throw new ParseLimitError({
      code: 'YAML_ALIAS_NOT_ALLOWED',
      message: `YAML aliases are disabled (maximum ${PARSE_LIMITS.maxAliases}).`,
      ...nodePosition(node, lineCounter)
    });
  }
  if (isScalar(node)) {
    const value = node.value;
    if (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'boolean' ||
      (typeof value === 'number' && Number.isFinite(value))
    ) {
      return {kind: 'scalar', value};
    }
    throw new TypeError('Parsed YAML contains an unsupported scalar value.');
  }
  if (isSeq(node)) {
    return {
      kind: 'sequence',
      items: node.items.map((item) => fragmentFromYamlNode(item, budget, depth + 1, lineCounter))
    };
  }
  if (isMap(node)) {
    return {
      kind: 'map',
      entries: node.items.map((item) => yamlPairToFragment(item, budget, depth, lineCounter))
    };
  }
  throw new TypeError('Parsed YAML contains an unsupported node type.');
}

function yamlPairToFragment(
  item: YamlPair,
  budget: ParseBudget,
  depth: number,
  lineCounter: LineCounter
): DataPair {
  if (!isScalar(item.key) || typeof item.key.value !== 'string') {
    throw new ParseLimitError({
      code: 'YAML_NON_STRING_KEY',
      message: 'YAML map keys must be strings.',
      ...nodePosition(item.key, lineCounter)
    });
  }
  return {
    kind: 'pair',
    key: item.key.value,
    value: fragmentFromYamlNode(item.value, budget, depth + 1, lineCounter)
  };
}

function consumeBudget(
  budget: ParseBudget,
  depth: number,
  position: {line: number; column: number} = {line: 0, column: 0}
): void {
  if (depth > PARSE_LIMITS.maxDepth) {
    throw new ParseLimitError({
      code: 'MAX_DEPTH_EXCEEDED',
      message: `Parsed data exceeds the maximum nesting depth of ${PARSE_LIMITS.maxDepth}.`,
      ...position
    });
  }
  budget.nodes += 1;
  if (budget.nodes > PARSE_LIMITS.maxNodes) {
    throw new ParseLimitError({
      code: 'MAX_NODES_EXCEEDED',
      message: `Parsed data exceeds the maximum node count of ${PARSE_LIMITS.maxNodes}.`,
      ...position
    });
  }
}

function validateInputSize(source: string): ParseDiagnostic | null {
  const bytes = new TextEncoder().encode(source).byteLength;
  if (bytes <= PARSE_LIMITS.maxInputBytes) return null;
  return {
    code: 'MAX_INPUT_BYTES_EXCEEDED',
    message: `Input is ${bytes} bytes; the maximum is ${PARSE_LIMITS.maxInputBytes} bytes.`,
    line: 0,
    column: 0
  };
}

function resolveFormat(source: string, format: ParseFormat): ResolvedParseFormat {
  if (format === 'json' || format === 'yaml') return format;
  const errors: JsonParseError[] = [];
  parseJsonText(source, errors, {
    allowEmptyContent: false,
    allowTrailingComma: false,
    disallowComments: true
  });
  return errors.length === 0 ? 'json' : 'yaml';
}

function failure(format: ResolvedParseFormat, diagnostic: ParseDiagnostic): ParseResult {
  return {success: false, format, fragment: null, diagnostic};
}

function positionAt(source: string, offset: number): {line: number; column: number} {
  const before = source.slice(0, Math.max(0, offset));
  const lines = before.split('\n');
  return {line: lines.length, column: (lines.at(-1)?.length ?? 0) + 1};
}

function nodePosition(node: unknown, lineCounter: LineCounter): {line: number; column: number} {
  if (typeof node !== 'object' || node === null || !('range' in node)) {
    return {line: 0, column: 0};
  }
  const range = (node as {range: unknown}).range;
  const offset = Array.isArray(range) && typeof range[0] === 'number' ? range[0] : undefined;
  return offset === undefined ? {line: 0, column: 0} : yamlPosition(lineCounter, offset);
}

function yamlPosition(lineCounter: LineCounter, offset: number): {line: number; column: number} {
  const {line, col} = lineCounter.linePos(offset);
  return {line, column: col};
}

class ParseLimitError extends Error {
  public constructor(public readonly diagnostic: ParseDiagnostic) {
    super(diagnostic.message);
    this.name = 'ParseLimitError';
  }
}

function isPlainObject(value: DataValue): value is {readonly [key: string]: DataValue} {
  return typeof value === 'object' && value !== null && !isDataArray(value);
}

function isDataArray(value: DataValue): value is readonly DataValue[] {
  return Array.isArray(value);
}

function spaces(count: number): string {
  return ' '.repeat(count);
}
