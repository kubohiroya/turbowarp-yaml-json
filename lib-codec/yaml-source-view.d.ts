import { type SourceSyntaxBaseline } from './source-syntax.js';
import { type YamlBlockView, type YamlBlockViewOptions, type YamlSyntaxNode, type YamlViewDescriptor } from './yaml-blocks.js';
/** The syntax codec alone owns YAML serialization and CST retention. */
export declare function createYamlSourceBlockView({ source, format, sourceRevision, ...viewOptions }: Omit<YamlBlockViewOptions, 'tree'> & {
    source: string;
    format?: 'yaml' | 'json';
    sourceRevision?: string;
}): YamlBlockView & {
    baseline: SourceSyntaxBaseline;
};
export declare function readYamlSourceBlockView({ baseline, source, format, blocks, descriptor, sourceRevision }: {
    baseline?: SourceSyntaxBaseline;
    source?: string;
    format?: 'yaml' | 'json';
    blocks: Readonly<Record<string, unknown>>;
    descriptor: YamlViewDescriptor;
    sourceRevision?: string;
}): {
    source: string;
    format: 'yaml' | 'json';
    tree: YamlSyntaxNode;
};
