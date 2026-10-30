export type DataScalarValue = string | number | boolean | null;
export type DataValue = DataScalarValue | readonly DataValue[] | {
    readonly [key: string]: DataValue;
};
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
export type ParseResult = {
    readonly success: true;
    readonly format: ResolvedParseFormat;
    readonly fragment: DataFragment;
    readonly diagnostic: null;
} | {
    readonly success: false;
    readonly format: ResolvedParseFormat;
    readonly fragment: null;
    readonly diagnostic: ParseDiagnostic;
};
export declare const PARSE_LIMITS: {
    readonly maxInputBytes: number;
    readonly maxDepth: 64;
    readonly maxNodes: 50000;
    readonly maxAliases: 0;
};
export declare const empty: DataEmpty;
export declare function stringValue(value: string): DataScalar;
export declare function numberValue(value: number): DataScalar;
export declare function booleanValue(value: boolean): DataScalar;
export declare function nullValue(): DataScalar;
export declare function pair(key: string, value: DataFragment | string): DataPair;
export declare function map(entries: DataFragment | string): DataMap;
export declare function sequence(items: DataFragment | string): DataSequence;
export declare function concat(left: DataFragment, right: DataFragment): DataFragment;
export declare function renderYaml(fragment: DataFragment, keyOrder?: 'preserve' | 'unicode'): string;
export declare function renderJson(fragment: DataFragment): string;
export declare function toValue(fragment: DataFragment): DataValue;
export declare function validateWithJsonSchema(schemaJson: string, fragment: DataFragment): SchemaValidationResult;
export declare function parseData(source: string, format?: ParseFormat, { jsonObjects }?: {
    jsonObjects?: 'legacy-fragment' | 'json';
}): ParseResult;
/** Convert only finite, acyclic JSON values through the canonical fragment builder. */
export declare function fromValue(value: unknown, { enforceLimits }?: {
    enforceLimits?: boolean;
}): DataFragment;
export declare function formatValidationResult(result: SchemaValidationResult): string;
export declare function normalizeContent(content: DataFragment | string): DataFragment;
