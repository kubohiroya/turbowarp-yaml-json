import {describe, expect, it} from 'vitest';
import {
  booleanValue,
  concat,
  formatValidationResult,
  map,
  nullValue,
  numberValue,
  pair,
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

    expect(validateWithJsonSchema(schema, valid)).toEqual({valid: true, errors: []});
    expect(formatValidationResult(validateWithJsonSchema(schema, valid))).toBe('valid');
    expect(formatValidationResult(validateWithJsonSchema(schema, invalid))).toContain(
      '/temperature must be number'
    );
  });

  it('reports invalid JSON Schema input without throwing', () => {
    expect(formatValidationResult(validateWithJsonSchema('{', map(pair('ok', booleanValue(true)))))).toContain(
      'Invalid JSON Schema:'
    );
  });

  it('renders mixed top-level concatenation with the same value semantics as JSON', () => {
    const document = concat(stringValue('a'), stringValue('b'));
    expect(toValue(document)).toEqual(['a', 'b']);
    expect(renderYaml(document)).toBe('- "a"\n- "b"');
    expect(renderJson(document)).toBe('[\n  "a",\n  "b"\n]\n');
  });

  it('uses last-write-wins consistently for duplicate map keys', () => {
    const document = map(concat(pair('name', stringValue('old')), pair('name', stringValue('new'))));
    expect(toValue(document)).toEqual({name: 'new'});
    expect(renderYaml(document)).toBe('name: "new"');
    expect(renderJson(document)).toBe('{\n  "name": "new"\n}\n');
  });
});
