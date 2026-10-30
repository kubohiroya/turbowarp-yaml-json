import assert from 'node:assert/strict';
import {describe, it, expect} from 'vitest';
import {parseValue, fromValue, serializeValue, PARSE_LIMITS} from '../src/codec.js';
import {toValue, parseData, renderYaml} from '../src/yaml-json.js';
import {validateValueWithJsonSchema} from '../src/schema.js';
describe('pure document value codec', () => {
  it('reuses existing parsing and exposes the same diagnostics without modifying source', () => {
    const source = '# comment\nz: 2\na: [true, null]\n';
    const parsed = parseValue(source, 'yaml');
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.value).toEqual({z: 2, a: [true, null]});
    for (const input of ['base: &x [1]\ncopy: *x', '1: value', 'a: [']) {
      const old = parseData(input, 'yaml');
      const next = parseValue(input, 'yaml');
      expect(next.diagnostic).toEqual(old.diagnostic);
    }
    expect(parseValue('x'.repeat(PARSE_LIMITS.maxInputBytes + 1), 'yaml').diagnostic?.code).toBe(
      'MAX_INPUT_BYTES_EXCEEDED'
    );
  });
  it('keeps native JSON own properties while leaving legacy fragments unchanged', () => {
    const source = '{"__proto__":{"kept":true},"constructor":1}';
    const native = parseValue(source, 'json');
    expect(native.success).toBe(true);
    if (native.success)
      expect(Object.getOwnPropertyDescriptor(native.value, '__proto__')?.value).toEqual({
        kept: true
      });
    const legacy = parseData(source, 'json');
    if (legacy.success)
      expect(Object.hasOwn(toValue(legacy.fragment) as object, '__proto__')).toBe(false);
    expect(Object.hasOwn(Object.prototype, 'kept')).toBe(false);
  });

  it('converts only safe finite JSON values to the original fragment model', () => {
    expect(toValue(fromValue({a: [1, true, null]}))).toEqual({a: [1, true, null]});
    const cycle: {self?: unknown} = {};
    cycle.self = cycle;
    for (const value of [
      cycle,
      NaN,
      new Date(),
      Array(2),
      {
        get x() {
          throw new Error('must not execute');
        }
      }
    ])
      expect(() => fromValue(value)).toThrow();
  });
  it('uses explicit canonical ordering and preserves existing fragment rendering', () => {
    const value = {'2': 'two', '10': 'ten', '𐀀': 1, '': 2, a: [{z: 2, a: 1}]};
    expect(
      serializeValue(value, {
        format: 'json',
        keyOrder: 'unicode',
        indent: 0,
        trailingNewline: false
      })
    ).toBe('{"10":"ten","2":"two","a":[{"a":1,"z":2}],"":2,"𐀀":1}');
    expect(
      serializeValue(value, {format: 'yaml', keyOrder: 'unicode'}).startsWith(
        '"10": "ten"\n"2": "two"'
      )
    ).toBe(true);
    const fragment = fromValue({z: 2, a: 1});
    expect(renderYaml(fragment)).toBe('z: 2\na: 1');
  });
  it('keeps full Schema dialect profiles explicit and separate from the legacy validator', () => {
    const schema = {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'array',
      prefixItems: [{const: '4.0'}],
      items: false
    };
    expect(validateValueWithJsonSchema(schema, ['4.0'], {dialect: '2020-12'}).valid).toBe(true);
    expect(validateValueWithJsonSchema(schema, ['3.2'], {dialect: '2020-12'}).valid).toBe(false);
    expect(validateValueWithJsonSchema(schema, ['4.0']).valid).toBe(false);
    expect(validateValueWithJsonSchema({type: 'number'}, 3).valid).toBe(true);
  });
});

it('repeated inline schema IDs validate independently without retaining an implicit schema registry', () => {
  for (const dialect of ['draft-07', '2020-12'] as const) {
    const schema = {$id: 'https://example.test/repeated-inline-schema', type: 'number', minimum: 2};
    assert.equal(validateValueWithJsonSchema(schema, 3, {dialect}).valid, true);
    assert.equal(validateValueWithJsonSchema(structuredClone(schema), 1, {dialect}).valid, false);
    const changed = {$id: schema.$id, type: 'string', minLength: 2};
    assert.equal(validateValueWithJsonSchema(changed, 'valid', {dialect}).valid, true);
    assert.equal(validateValueWithJsonSchema(changed, 3, {dialect}).valid, false);
    for (let index = 0; index < 40; index++)
      assert.equal(
        validateValueWithJsonSchema(
          {$id: `https://example.test/cache-${index}`, type: 'number'},
          3,
          {dialect}
        ).valid,
        true
      );
    assert.equal(validateValueWithJsonSchema(schema, 3, {dialect}).valid, true);
  }
});
