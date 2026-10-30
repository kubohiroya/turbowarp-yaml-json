import { type ParseFormat } from './codec.js';
export interface SourceSyntaxComment {
    id: string;
    kind: 'comment';
    /** One comment line without its line terminator; empty lines remain explicit nodes. */
    text: string;
}
export interface SourceSyntaxComments {
    before?: SourceSyntaxComment[];
    inline?: SourceSyntaxComment[];
    after?: SourceSyntaxComment[];
}
interface Base {
    id: string;
    comments?: SourceSyntaxComments;
}
export interface SourceSyntaxScalar extends Base {
    kind: 'scalar';
    value: string | number | boolean | null;
}
export interface SourceSyntaxPair extends Base {
    kind: 'pair';
    key: SourceSyntaxScalar;
    value: SourceSyntaxNode;
}
export type SourceSyntaxNode = SourceSyntaxScalar | (Base & {
    kind: 'map';
    entries: SourceSyntaxPair[];
}) | (Base & {
    kind: 'sequence';
    items: SourceSyntaxNode[];
});
export interface SourceSyntaxBaseline {
    readonly sourceSyntaxBaseline: true;
}
export interface SourceSyntaxResult {
    baseline: SourceSyntaxBaseline;
    format: 'yaml' | 'json';
    tree: SourceSyntaxNode;
}
export declare class SourceSyntaxError extends Error {
    readonly code: string;
    constructor(code: string, message: string);
}
export declare function parseSourceSyntax(source: string, options?: {
    format?: ParseFormat;
}): SourceSyntaxResult;
export declare function applySourceSyntaxEdits(baseline: SourceSyntaxBaseline, edits: readonly {
    op: 'replace-tree';
    tree: SourceSyntaxNode;
}[]): {
    source: string;
    format: 'yaml' | 'json';
    tree: SourceSyntaxNode;
};
export {};
