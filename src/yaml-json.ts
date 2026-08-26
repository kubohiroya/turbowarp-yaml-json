import Ajv, {type AnySchema, type ErrorObject} from 'ajv';

export type DataScalarValue = string | number | boolean | null;
export type DataValue = DataScalarValue | readonly DataValue[] | {readonly [key: string]: DataValue};

export type DataFragment =
  | DataScalar
  | DataPair
  | DataMap
  | DataSequence
  | DataConcat
  | DataEmpty;

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
    return {valid: false, errors: [`Invalid JSON Schema: ${formatErrorMessage(error)}`]};
  }

  try {
    const validate = ajv.compile(schema as AnySchema);
    if (validate(toValue(fragment))) return {valid: true, errors: []};
    return {valid: false, errors: formatAjvErrors(validate.errors ?? [])};
  } catch (error) {
    return {valid: false, errors: [`Invalid JSON Schema: ${formatErrorMessage(error)}`]};
  }
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

function isPlainObject(value: DataValue): value is {readonly [key: string]: DataValue} {
  return typeof value === 'object' && value !== null && !isDataArray(value);
}

function isDataArray(value: DataValue): value is readonly DataValue[] {
  return Array.isArray(value);
}

function spaces(count: number): string {
  return ' '.repeat(count);
}
