import Ajv from 'ajv';
import { parse as parseJsonText, printParseErrorCode } from 'jsonc-parser';
import { isAlias, isMap, isScalar, isSeq, LineCounter, parseDocument } from 'yaml';
export const PARSE_LIMITS = {
    maxInputBytes: 256 * 1024,
    maxDepth: 64,
    maxNodes: 50000,
    maxAliases: 0
};
export const empty = { kind: 'empty' };
const SIMPLE_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_-]*$/u;
let ajv;
export function stringValue(value) {
    return { kind: 'scalar', value };
}
export function numberValue(value) {
    return { kind: 'scalar', value: Number.isFinite(value) ? value : 0 };
}
export function booleanValue(value) {
    return { kind: 'scalar', value };
}
export function nullValue() {
    return { kind: 'scalar', value: null };
}
export function pair(key, value) {
    return { kind: 'pair', key, value: normalizeContent(value) };
}
export function map(entries) {
    return { kind: 'map', entries: normalizeEntries(entries) };
}
export function sequence(items) {
    return { kind: 'sequence', items: normalizeItems(items) };
}
export function concat(left, right) {
    const children = [...flattenConcat(left), ...flattenConcat(right)].filter((child) => child.kind !== 'empty');
    if (children.length === 0)
        return empty;
    if (children.length === 1)
        return children[0] ?? empty;
    return { kind: 'concat', children };
}
export function renderYaml(fragment, keyOrder = 'preserve') {
    return renderYamlValue(toValue(fragment), 0, keyOrder);
}
export function renderJson(fragment) {
    return `${JSON.stringify(toValue(fragment), null, 2)}\n`;
}
export function toValue(fragment) {
    switch (fragment.kind) {
        case 'empty':
            return null;
        case 'scalar':
            return fragment.value;
        case 'pair':
            return { [fragment.key]: toValue(fragment.value) };
        case 'map':
            return Object.fromEntries(fragment.entries.map((entry) => [entry.key, toValue(entry.value)]));
        case 'sequence':
            return fragment.items.map(toValue);
        case 'concat':
            return mergeTopLevelValues(fragment.children);
    }
}
export function validateWithJsonSchema(schemaJson, fragment) {
    let schema;
    try {
        schema = JSON.parse(schemaJson);
    }
    catch (error) {
        return {
            valid: false,
            errors: [`Invalid JSON Schema: ${formatErrorMessage(error)}`]
        };
    }
    try {
        ajv ?? (ajv = new Ajv({ allErrors: true, strict: false }));
        const validate = ajv.compile(schema);
        if (validate(toValue(fragment)))
            return { valid: true, errors: [] };
        return { valid: false, errors: formatAjvErrors(validate.errors ?? []) };
    }
    catch (error) {
        return {
            valid: false,
            errors: [`Invalid JSON Schema: ${formatErrorMessage(error)}`]
        };
    }
}
export function parseData(source, format = 'auto', { jsonObjects = 'legacy-fragment' } = {}) {
    const selectedFormat = resolveFormat(source, format);
    const inputDiagnostic = validateInputSize(source);
    if (inputDiagnostic !== null)
        return failure(selectedFormat, inputDiagnostic);
    return selectedFormat === 'json' ? parseJson(source, jsonObjects === 'json') : parseYaml(source);
}
/** Convert only finite, acyclic JSON values through the canonical fragment builder. */
export function fromValue(value, { enforceLimits = true } = {}) {
    const active = new Set();
    let nodes = 0;
    const check = (item, depth) => {
        if (++nodes > PARSE_LIMITS.maxNodes && enforceLimits)
            throw new TypeError('Value exceeds the maximum node count.');
        if (depth > PARSE_LIMITS.maxDepth && enforceLimits)
            throw new TypeError('Value exceeds the maximum nesting depth.');
        if (item === null ||
            typeof item === 'string' ||
            typeof item === 'boolean' ||
            (typeof item === 'number' && Number.isFinite(item)))
            return;
        if (typeof item !== 'object')
            throw new TypeError('Value must contain only finite JSON data.');
        if (active.has(item))
            throw new TypeError('Cyclic JSON values are not supported.');
        if (!Array.isArray(item) &&
            Object.getPrototypeOf(item) !== Object.prototype &&
            Object.getPrototypeOf(item) !== null)
            throw new TypeError('JSON objects must be plain objects.');
        if (Array.isArray(item))
            for (let index = 0; index < item.length; index++)
                if (!Object.hasOwn(item, index))
                    throw new TypeError('Sparse arrays are not JSON values.');
        active.add(item);
        for (const key of Object.keys(item)) {
            const descriptor = Object.getOwnPropertyDescriptor(item, key);
            if (!Object.hasOwn(descriptor, 'value'))
                throw new TypeError('JSON properties cannot be accessors.');
            check(descriptor.value, depth + 1);
        }
        active.delete(item);
    };
    check(value, 0);
    return fragmentFromUnknown(value, { nodes: 0, limited: enforceLimits }, 0);
}
export function formatValidationResult(result) {
    return result.valid ? 'valid' : result.errors.join('\n');
}
export function normalizeContent(content) {
    return typeof content === 'string' ? stringValue(content) : content;
}
function normalizeEntries(entries) {
    const fragment = normalizeContent(entries);
    if (fragment.kind === 'empty')
        return [];
    if (fragment.kind === 'map')
        return fragment.entries;
    const children = flattenConcat(fragment);
    if (children.every((child) => child.kind === 'pair'))
        return children;
    throw new TypeError('Map entries must be pair fragments.');
}
function normalizeItems(items) {
    const fragment = normalizeContent(items);
    if (fragment.kind === 'empty')
        return [];
    if (fragment.kind === 'concat')
        return fragment.children;
    return [fragment];
}
function flattenConcat(fragment) {
    if (fragment.kind === 'concat')
        return fragment.children.flatMap(flattenConcat);
    return [fragment];
}
function mergeTopLevelValues(children) {
    const values = children.filter((child) => child.kind !== 'empty').map(toValue);
    if (values.length === 0)
        return null;
    if (values.every(isPlainObject))
        return Object.assign({}, ...values);
    return values;
}
function renderYamlValue(value, indent, keyOrder) {
    if (isPlainObject(value)) {
        const entries = Object.entries(value);
        if (keyOrder === 'unicode')
            entries.sort(([a], [b]) => compareKeyCodePoints(a, b));
        if (entries.length === 0)
            return `${spaces(indent)}{}`;
        return entries
            .map(([key, entryValue]) => renderValuePair(key, entryValue, indent, keyOrder))
            .join('\n');
    }
    if (isDataArray(value)) {
        if (value.length === 0)
            return `${spaces(indent)}[]`;
        return value.map((item) => renderSequenceItem(item, indent, keyOrder)).join('\n');
    }
    return `${spaces(indent)}${renderScalar(value)}`;
}
function renderValuePair(key, value, indent, keyOrder) {
    const prefix = `${spaces(indent)}${renderKey(key)}:`;
    if (!isPlainObject(value) && !isDataArray(value))
        return `${prefix} ${renderScalar(value)}`;
    return `${prefix}\n${renderYamlValue(value, indent + 2, keyOrder)}`;
}
function renderSequenceItem(item, indent, keyOrder) {
    const prefix = `${spaces(indent)}-`;
    if (!isPlainObject(item) && !isDataArray(item))
        return `${prefix} ${renderScalar(item)}`;
    return `${prefix}\n${renderYamlValue(item, indent + 2, keyOrder)}`;
}
function renderKey(key) {
    return SIMPLE_KEY_PATTERN.test(key) ? key : JSON.stringify(key);
}
function renderScalar(value) {
    if (value === null)
        return 'null';
    if (typeof value === 'boolean')
        return value ? 'true' : 'false';
    if (typeof value === 'number')
        return String(value);
    return JSON.stringify(value);
}
function formatAjvErrors(errors) {
    if (errors.length === 0)
        return ['JSON Schema validation failed.'];
    return errors.map((error) => {
        const path = error.instancePath.length > 0 ? error.instancePath : '$';
        return `${path} ${error.message ?? 'is invalid'}`;
    });
}
function formatErrorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
function parseJson(source, nativeJsonObjects = false) {
    const errors = [];
    const value = parseJsonText(source, errors, {
        allowEmptyContent: false,
        allowTrailingComma: false,
        disallowComments: true
    });
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
            fragment: fragmentFromUnknown(nativeJsonObjects ? JSON.parse(source) : value, { nodes: 0 }, 0),
            diagnostic: null
        };
    }
    catch (error) {
        if (error instanceof ParseLimitError)
            return failure('json', error.diagnostic);
        return failure('json', {
            code: nativeJsonObjects && error instanceof SyntaxError ? 'INVALID_JSON' : 'INVALID_JSON_VALUE',
            message: formatErrorMessage(error),
            line: 0,
            column: 0
        });
    }
}
function parseYaml(source) {
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
            fragment: fragmentFromYamlNode(document.contents, { nodes: 0 }, 0, lineCounter),
            diagnostic: null
        };
    }
    catch (caught) {
        if (caught instanceof ParseLimitError)
            return failure('yaml', caught.diagnostic);
        return failure('yaml', {
            code: 'INVALID_YAML_VALUE',
            message: formatErrorMessage(caught),
            line: 0,
            column: 0
        });
    }
}
function fragmentFromUnknown(value, budget, depth) {
    consumeBudget(budget, depth);
    if (value === null || typeof value === 'string' || typeof value === 'boolean') {
        return { kind: 'scalar', value };
    }
    if (typeof value === 'number' && Number.isFinite(value))
        return { kind: 'scalar', value };
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
function fragmentFromYamlNode(node, budget, depth, lineCounter) {
    consumeBudget(budget, depth, nodePosition(node, lineCounter));
    if (node === null)
        return nullValue();
    if (isAlias(node)) {
        throw new ParseLimitError({
            code: 'YAML_ALIAS_NOT_ALLOWED',
            message: `YAML aliases are disabled (maximum ${PARSE_LIMITS.maxAliases}).`,
            ...nodePosition(node, lineCounter)
        });
    }
    if (isScalar(node)) {
        const value = node.value;
        if (value === null ||
            typeof value === 'string' ||
            typeof value === 'boolean' ||
            (typeof value === 'number' && Number.isFinite(value))) {
            return { kind: 'scalar', value };
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
function yamlPairToFragment(item, budget, depth, lineCounter) {
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
function consumeBudget(budget, depth, position = { line: 0, column: 0 }) {
    if (budget.limited !== false && depth > PARSE_LIMITS.maxDepth) {
        throw new ParseLimitError({
            code: 'MAX_DEPTH_EXCEEDED',
            message: `Parsed data exceeds the maximum nesting depth of ${PARSE_LIMITS.maxDepth}.`,
            ...position
        });
    }
    budget.nodes += 1;
    if (budget.limited !== false && budget.nodes > PARSE_LIMITS.maxNodes) {
        throw new ParseLimitError({
            code: 'MAX_NODES_EXCEEDED',
            message: `Parsed data exceeds the maximum node count of ${PARSE_LIMITS.maxNodes}.`,
            ...position
        });
    }
}
function validateInputSize(source) {
    const bytes = new TextEncoder().encode(source).byteLength;
    if (bytes <= PARSE_LIMITS.maxInputBytes)
        return null;
    return {
        code: 'MAX_INPUT_BYTES_EXCEEDED',
        message: `Input is ${bytes} bytes; the maximum is ${PARSE_LIMITS.maxInputBytes} bytes.`,
        line: 0,
        column: 0
    };
}
function resolveFormat(source, format) {
    if (format === 'json' || format === 'yaml')
        return format;
    const errors = [];
    parseJsonText(source, errors, {
        allowEmptyContent: false,
        allowTrailingComma: false,
        disallowComments: true
    });
    return errors.length === 0 ? 'json' : 'yaml';
}
function failure(format, diagnostic) {
    return { success: false, format, fragment: null, diagnostic };
}
function positionAt(source, offset) {
    const before = source.slice(0, Math.max(0, offset));
    const lines = before.split('\n');
    return { line: lines.length, column: (lines.at(-1)?.length ?? 0) + 1 };
}
function nodePosition(node, lineCounter) {
    if (typeof node !== 'object' || node === null || !('range' in node)) {
        return { line: 0, column: 0 };
    }
    const range = node.range;
    const offset = Array.isArray(range) && typeof range[0] === 'number' ? range[0] : undefined;
    return offset === undefined ? { line: 0, column: 0 } : yamlPosition(lineCounter, offset);
}
function yamlPosition(lineCounter, offset) {
    const { line, col } = lineCounter.linePos(offset);
    return { line, column: col };
}
class ParseLimitError extends Error {
    constructor(diagnostic) {
        super(diagnostic.message);
        this.diagnostic = diagnostic;
        this.name = 'ParseLimitError';
    }
}
function isPlainObject(value) {
    return typeof value === 'object' && value !== null && !isDataArray(value);
}
function isDataArray(value) {
    return Array.isArray(value);
}
function spaces(count) {
    return ' '.repeat(count);
}
function compareKeyCodePoints(left, right) {
    const a = Array.from(left), b = Array.from(right);
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
        const difference = a[i].codePointAt(0) - b[i].codePointAt(0);
        if (difference)
            return difference;
    }
    return a.length - b.length;
}
