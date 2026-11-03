import {
    parseSourceSyntax,
    applySourceSyntaxEdits,
    type SourceSyntaxBaseline
} from './source-syntax.js';
import { fail } from '@kubohiroya/turbowarp-document-source/protocol';
import {
    createYamlBlockView,
    readYamlBlockView,
    type YamlBlockView,
    type YamlBlockViewOptions,
    type YamlSyntaxNode,
    type YamlViewDescriptor
} from './yaml-blocks.js';
/** The syntax codec alone owns YAML serialization and CST retention. */
export function createYamlSourceBlockView({
    source,
    format = 'yaml',
    sourceRevision,
    ...viewOptions
}: Omit<YamlBlockViewOptions, 'tree'> & {
    source: string;
    format?: 'yaml' | 'json';
    sourceRevision?: string;
}): YamlBlockView & { baseline: SourceSyntaxBaseline } {
    const syntax = parseSourceSyntax(source, { format });
    const view = createYamlBlockView({ ...viewOptions, tree: syntax.tree });
    if (sourceRevision !== undefined) {
        if (typeof sourceRevision !== 'string' || !sourceRevision)
            fail('YAML_BLOCK_VIEW_STALE', 'A source revision must be a nonempty string.');
        view.descriptor.baseSourceRevision = sourceRevision;
    }
    return { baseline: syntax.baseline, ...view };
}
export function readYamlSourceBlockView({ baseline, source, format = 'yaml', blocks, descriptor, sourceRevision }: {
    baseline?: SourceSyntaxBaseline;
    source?: string;
    format?: 'yaml' | 'json';
    blocks: Readonly<Record<string, unknown>>;
    descriptor: YamlViewDescriptor;
    sourceRevision?: string;
}): { source: string; format: 'yaml' | 'json'; tree: YamlSyntaxNode } {
    if (
        descriptor.baseSourceRevision !== undefined &&
        descriptor.baseSourceRevision !== sourceRevision
    )
        fail('YAML_BLOCK_VIEW_STALE', 'The source changed after this block view was created.');
    const tree = readYamlBlockView({ blocks, descriptor });
    // Keep opaque syntax baselines inside the codec's own module instance.
    if (source !== undefined) baseline = parseSourceSyntax(source, {format}).baseline;
    return applySourceSyntaxEdits(baseline as SourceSyntaxBaseline, [{ op: 'replace-tree', tree }]);
}
