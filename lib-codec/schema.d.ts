import { type SchemaValidationResult } from './yaml-json.js';
export type { SchemaValidationResult } from './yaml-json.js';
export type SchemaDialect = 'draft-07' | '2020-12';
/** Full JSON Schema profiles for source owners; unrelated to structured-data's runtime subset. */
export declare function validateValueWithJsonSchema(schema: unknown, value: unknown, { dialect }?: {
    dialect?: SchemaDialect;
}): SchemaValidationResult;
