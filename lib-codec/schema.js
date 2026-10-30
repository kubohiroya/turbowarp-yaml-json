import Ajv from 'ajv';
import Ajv2020 from 'ajv/dist/2020.js';
import { fromValue, toValue } from './yaml-json.js';
const profiles = {
    'draft-07': new Ajv({ allErrors: true, strict: false, addUsedSchema: false }),
    '2020-12': new Ajv2020({ allErrors: true, strict: false, addUsedSchema: false })
};
const compiled = {
    'draft-07': new Map(),
    '2020-12': new Map()
};
const maxCompiledSchemas = 32;
/** Full JSON Schema profiles for source owners; unrelated to structured-data's runtime subset. */
export function validateValueWithJsonSchema(schema, value, { dialect = 'draft-07' } = {}) {
    try {
        if (!Object.hasOwn(profiles, dialect))
            throw new TypeError('Unsupported JSON Schema dialect.');
        const document = toValue(fromValue(schema));
        const candidate = toValue(fromValue(value));
        const key = JSON.stringify(document), cache = compiled[dialect];
        let entry = cache.get(key);
        if (!entry) {
            entry = {
                document: document,
                validate: profiles[dialect].compile(document)
            };
            cache.set(key, entry);
            if (cache.size > maxCompiledSchemas) {
                const oldest = cache.keys().next().value;
                profiles[dialect].removeSchema(cache.get(oldest).document);
                cache.delete(oldest);
            }
        }
        const { validate } = entry;
        if (validate(candidate))
            return { valid: true, errors: [] };
        return {
            valid: false,
            errors: (validate.errors ?? []).map((error) => `${error.instancePath || '/'} ${error.message ?? 'is invalid'}`)
        };
    }
    catch (error) {
        return {
            valid: false,
            errors: [
                `Invalid JSON Schema or value: ${error instanceof Error ? error.message : String(error)}`
            ]
        };
    }
}
