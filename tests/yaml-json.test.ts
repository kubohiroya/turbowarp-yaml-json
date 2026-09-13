import {describe, expect, it} from 'vitest';
import {
  booleanValue,
  concat,
  formatValidationResult,
  map,
  nullValue,
  numberValue,
  pair,
  parseData,
  PARSE_LIMITS,
  renderJson,
  renderYaml,
  sequence,
  stringValue,
  toValue,
  validateWithJsonSchema
} from '../src/yaml-json.js';

describe('YAML/JSON builder API', () => {
  it('renders representative data as YAML and JSON', () => {
    const document = map(
      concat(
        pair('name', stringValue('sensor')),
        pair('readings', sequence(concat(numberValue(21), numberValue(22))))
      )
    );

    expect(renderYaml(document)).toBe('name: "sensor"\nreadings:\n  - 21\n  - 22');
    expect(renderJson(document)).toBe(
      '{\n  "name": "sensor",\n  "readings": [\n    21,\n    22\n  ]\n}\n'
    );
  });

  it('builds nested maps, sequences, booleans, and null values', () => {
    const document = map(
      concat(
        pair('enabled', booleanValue(true)),
        pair('meta', map(concat(pair('owner', 'TurboWarp'), pair('note', nullValue()))))
      )
    );

    expect(toValue(document)).toEqual({
      enabled: true,
      meta: {owner: 'TurboWarp', note: null}
    });
    expect(renderYaml(document)).toBe('enabled: true\nmeta:\n  owner: "TurboWarp"\n  note: null');
  });

  it('quotes unsafe YAML keys and string scalars deterministically', () => {
    const document = map(pair('content type', stringValue('application/yaml; charset=utf-8')));
    expect(renderYaml(document)).toBe('"content type": "application/yaml; charset=utf-8"');
  });

  it('validates built data with JSON Schema', () => {
    const schema = JSON.stringify({
      type: 'object',
      required: ['temperature'],
      properties: {temperature: {type: 'number'}}
    });
    const valid = map(pair('temperature', numberValue(21)));
    const invalid = map(pair('temperature', stringValue('21')));

    expect(validateWithJsonSchema(schema, valid)).toEqual({
      valid: true,
      errors: []
    });
    expect(formatValidationResult(validateWithJsonSchema(schema, valid))).toBe('valid');
    expect(formatValidationResult(validateWithJsonSchema(schema, invalid))).toContain(
      '/temperature must be number'
    );
  });

  it('reports invalid JSON Schema input without throwing', () => {
    expect(
      formatValidationResult(validateWithJsonSchema('{', map(pair('ok', booleanValue(true)))))
    ).toContain('Invalid JSON Schema:');
  });

  it('renders mixed top-level concatenation with the same value semantics as JSON', () => {
    const document = concat(stringValue('a'), stringValue('b'));
    expect(toValue(document)).toEqual(['a', 'b']);
    expect(renderYaml(document)).toBe('- "a"\n- "b"');
    expect(renderJson(document)).toBe('[\n  "a",\n  "b"\n]\n');
  });

  it('uses last-write-wins consistently for duplicate map keys', () => {
    const document = map(
      concat(pair('name', stringValue('old')), pair('name', stringValue('new')))
    );
    expect(toValue(document)).toEqual({name: 'new'});
    expect(renderYaml(document)).toBe('name: "new"');
    expect(renderJson(document)).toBe('{\n  "name": "new"\n}\n');
  });

  it('safely parses YAML and JSON into fragments accepted by render and schema validation', () => {
    const yamlResult = parseData('name: sensor\nperformers:\n  - id: 1\n  - id: 2', 'yaml');
    const jsonResult = parseData('{"name":"sensor","enabled":true}', 'auto');

    expect(yamlResult.success).toBe(true);
    expect(jsonResult.success).toBe(true);
    if (!yamlResult.success || !jsonResult.success) throw new Error('Expected successful parses.');
    expect(yamlResult.format).toBe('yaml');
    expect(renderJson(yamlResult.fragment)).toContain('"performers"');
    expect(jsonResult.format).toBe('json');
    expect(
      validateWithJsonSchema('{"type":"object","required":["name","enabled"]}', jsonResult.fragment)
        .valid
    ).toBe(true);
  });

  it('reports explicit JSON syntax errors with one-based line and column', () => {
    const result = parseData('{\n  "name":\n}', 'json');
    expect(result.success).toBe(false);
    if (result.success) throw new Error('Expected a parse failure.');
    expect(result.diagnostic.code).toBe('INVALID_JSON');
    expect(result.diagnostic.line).toBeGreaterThan(0);
    expect(result.diagnostic.column).toBeGreaterThan(0);
  });

  it('rejects YAML aliases before resolving them', () => {
    const result = parseData('base: &base [1, 2, 3]\ncopy: *base', 'yaml');
    expect(result.success).toBe(false);
    if (result.success) throw new Error('Expected a parse failure.');
    expect(result.diagnostic.code).toBe('YAML_ALIAS_NOT_ALLOWED');
  });

  it('rejects unsafe or unknown YAML tags', () => {
    const result = parseData('run: !<tag:yaml.org,2002:js/function> "function () {}"', 'yaml');
    expect(result.success).toBe(false);
    if (result.success) throw new Error('Expected a parse failure.');
    expect(result.diagnostic.message).toMatch(/tag|resolve/iu);
  });

  it('rejects overlong input before parsing', () => {
    const result = parseData('x'.repeat(PARSE_LIMITS.maxInputBytes + 1), 'yaml');
    expect(result.success).toBe(false);
    if (result.success) throw new Error('Expected a parse failure.');
    expect(result.diagnostic.code).toBe('MAX_INPUT_BYTES_EXCEEDED');
  });

  it('rejects excessively nested values', () => {
    let value: unknown = null;
    for (let depth = 0; depth <= PARSE_LIMITS.maxDepth; depth += 1) value = [value];
    const result = parseData(JSON.stringify(value), 'json');
    expect(result.success).toBe(false);
    if (result.success) throw new Error('Expected a parse failure.');
    expect(result.diagnostic.code).toBe('MAX_DEPTH_EXCEEDED');
  });
});
