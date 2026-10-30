import { parseData, renderYaml, toValue, fromValue, PARSE_LIMITS } from './yaml-json.js';
export { fromValue, PARSE_LIMITS };
/** Parse through the existing bounded fragment parser; source text remains the owner's data. */
export function parseValue(source, format = 'auto') {
    const parsed = parseData(source, format, { jsonObjects: 'json' });
    return parsed.success
        ? { success: true, format: parsed.format, value: toValue(parsed.fragment), diagnostic: null }
        : { success: false, format: parsed.format, value: null, diagnostic: parsed.diagnostic };
}
/** Serialization is explicit and never replaces a document's preserved source implicitly. */
export function serializeValue(value, policy) {
    if (!policy ||
        !['json', 'yaml'].includes(policy.format) ||
        !['preserve', 'unicode'].includes(policy.keyOrder))
        throw new TypeError('An explicit format and key ordering policy are required.');
    if (policy.indent !== undefined &&
        (!Number.isInteger(policy.indent) || policy.indent < 0 || policy.indent > 10))
        throw new TypeError('JSON indentation must be an integer from 0 to 10.');
    const normalized = toValue(fromValue(value, { enforceLimits: policy.enforceValueLimits ?? true }));
    const ordered = normalized;
    const text = policy.format === 'json'
        ? stringify(ordered, policy.indent ?? 2, policy.keyOrder)
        : renderYaml(fromValue(ordered, { enforceLimits: policy.enforceValueLimits ?? true }), policy.keyOrder);
    return text + ((policy.trailingNewline ?? policy.format === 'json') ? '\n' : '');
}
function compare(left, right) {
    const a = Array.from(left), b = Array.from(right);
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
        const difference = a[i].codePointAt(0) - b[i].codePointAt(0);
        if (difference)
            return difference;
    }
    return a.length - b.length;
}
function stringify(value, indent, ordering, level = 0) {
    const pretty = indent > 0;
    const padding = (depth) => ' '.repeat(indent * depth);
    const render = (item) => stringify(item, indent, ordering, level + 1);
    if (Array.isArray(value)) {
        const entries = value.map(render);
        return entries.length
            ? '[' +
                (pretty ? '\n' + padding(level + 1) : '') +
                entries.join(pretty ? ',\n' + padding(level + 1) : ',') +
                (pretty ? '\n' + padding(level) : '') +
                ']'
            : '[]';
    }
    if (value !== null && typeof value === 'object') {
        const keys = Object.keys(value);
        if (ordering === 'unicode')
            keys.sort(compare);
        const entries = keys.map((key) => JSON.stringify(key) +
            (pretty ? ': ' : ':') +
            render(value[key]));
        return entries.length
            ? '{' +
                (pretty ? '\n' + padding(level + 1) : '') +
                entries.join(pretty ? ',\n' + padding(level + 1) : ',') +
                (pretty ? '\n' + padding(level) : '') +
                '}'
            : '{}';
    }
    return JSON.stringify(value);
}
