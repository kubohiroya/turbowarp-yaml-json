import type { SourceDocumentReference } from '@kubohiroya/turbowarp-document-source';
import type { SourceSyntaxNode } from './source-syntax.js';
import { yamlBlockIconURI } from './yaml-block-icon.js';
export { yamlBlockIconURI };
export type { SourceSyntaxNode as YamlSyntaxNode, SourceSyntaxComment as YamlCommentNode, SourceSyntaxScalar as YamlScalarNode, SourceSyntaxPair as YamlPairNode, } from './source-syntax.js';
export interface YamlBlockOpcodes {
    map: string;
    pair: string;
    sequence: string;
    item: string;
    scalar: string;
    text: string;
    textLine: string;
    comment: string;
    /** Optional for existing legacy custom opcode maps; newly generated maps provide both. */
    lineComment?: string;
    inlineComment?: string;
}
export interface YamlViewDescriptor {
    version: 2;
    reference: SourceDocumentReference;
    rootOpcode: string;
    opcodes: YamlBlockOpcodes;
    syntaxIdsByPath: Record<string, string>;
    baseSourceRevision?: string;
}
export interface YamlBlockDefinition {
    opcode: string;
    blockType: 'command';
    blockIconURI: string;
    hideFromPalette?: boolean;
    branchCount?: 1;
    text: string;
    arguments: Record<string, {
        type: 'string';
        defaultValue: string;
        menu?: string;
    }>;
}
export type YamlBlockMenus = Record<'yamlScalarTypes' | 'yamlCommentPlacements' | 'yamlLineCommentPlacements' | 'yamlLineBreaks', {
    acceptReporters: false;
    items: string[];
}>;
export type YamlViewInput = [1, [10, string]] | [2, string];
/** A serialized SB3 block generated for a YAML view. */
export type YamlViewBlock = {
    opcode: string;
    next: string | null;
    parent: string | null;
    inputs: Record<string, YamlViewInput>;
    fields: Record<string, [string, null]>;
    shadow: false;
    topLevel: boolean;
    x?: number;
    y?: number;
};
export interface YamlBlockViewOptions {
    reference: SourceDocumentReference;
    tree: SourceSyntaxNode;
    rootId: string;
    rootOpcode: string;
    opcodes?: YamlBlockOpcodes;
    idPrefix?: string;
    x?: number;
    y?: number;
}
export interface YamlBlockView {
    blocks: Record<string, YamlViewBlock>;
    rootId: string;
    nodeIds: Record<string, string>;
    keyIds: Record<string, string>;
    descriptor: YamlViewDescriptor;
}
export declare const yamlBlockOperations: Readonly<{
    readonly map: "yamlMap";
    readonly pair: "yamlKey";
    readonly sequence: "yamlSequence";
    readonly item: "yamlItem";
    readonly scalar: "yamlScalar";
    readonly text: "yamlText";
    readonly textLine: "yamlTextLine";
    readonly comment: "yamlComment";
    readonly lineComment: "yamlLineComment";
    readonly inlineComment: "yamlInlineComment";
}>;
/** Authoring declarations only: no YAML is executed by these blocks. */
export declare function createYamlBlockDefinitions(): YamlBlockDefinition[];
export declare function createYamlBlockMenus(): YamlBlockMenus;
export declare function createYamlBlockOpcodes(prefix?: string): Readonly<Required<YamlBlockOpcodes>>;
/** Build a derived view. The caller owns installation, source and transaction baselines. */
export declare function createYamlBlockView({ reference, tree, rootId, rootOpcode, opcodes, idPrefix, x, y, }: YamlBlockViewOptions): YamlBlockView;
/** Read literal data only; unknown blocks and reporters never execute during conversion. */
export declare function readYamlBlockView({ blocks, descriptor, }: {
    blocks: Readonly<Record<string, unknown>>;
    descriptor: YamlViewDescriptor;
}): SourceSyntaxNode;
