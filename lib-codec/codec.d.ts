import { fromValue, PARSE_LIMITS, type DataValue, type ParseDiagnostic, type ParseFormat, type ResolvedParseFormat } from './yaml-json.js';
export { fromValue, PARSE_LIMITS };
export type { DataValue, DataFragment, ParseDiagnostic, ParseFormat, ResolvedParseFormat } from './yaml-json.js';
export type ValueParseResult = {
    readonly success: true;
    readonly format: ResolvedParseFormat;
    readonly value: DataValue;
    readonly diagnostic: null;
} | {
    readonly success: false;
    readonly format: ResolvedParseFormat;
    readonly value: null;
    readonly diagnostic: ParseDiagnostic;
};
/** Parse through the existing bounded fragment parser; source text remains the owner's data. */
export declare function parseValue(source: string, format?: ParseFormat): ValueParseResult;
export interface SerializationPolicy {
    readonly format: 'json' | 'yaml';
    readonly keyOrder: 'preserve' | 'unicode';
    readonly indent?: number;
    readonly trailingNewline?: boolean;
    /** Existing runtime bindings may grow after parsing; preserving them is an explicit policy. */
    readonly enforceValueLimits?: boolean;
}
/** Serialization is explicit and never replaces a document's preserved source implicitly. */
export declare function serializeValue(value: DataValue, policy: SerializationPolicy): string;
