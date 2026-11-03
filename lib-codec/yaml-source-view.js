import { parseSourceSyntax, applySourceSyntaxEdits } from './source-syntax.js';
import { fail } from '@kubohiroya/turbowarp-document-source/protocol';
import { createYamlBlockView, readYamlBlockView } from './yaml-blocks.js';
/** The syntax codec alone owns YAML serialization and CST retention. */
export function createYamlSourceBlockView({ source, format = 'yaml', sourceRevision, ...viewOptions }) {
    const syntax = parseSourceSyntax(source, { format });
    const view = createYamlBlockView({ ...viewOptions, tree: syntax.tree });
    if (sourceRevision !== undefined) {
        if (typeof sourceRevision !== 'string' || !sourceRevision)
            fail('YAML_BLOCK_VIEW_STALE', 'A source revision must be a nonempty string.');
        view.descriptor.baseSourceRevision = sourceRevision;
    }
    return { baseline: syntax.baseline, ...view };
}
export function readYamlSourceBlockView({ baseline, source, format = 'yaml', blocks, descriptor, sourceRevision }) {
    if (descriptor.baseSourceRevision !== undefined &&
        descriptor.baseSourceRevision !== sourceRevision)
        fail('YAML_BLOCK_VIEW_STALE', 'The source changed after this block view was created.');
    const tree = readYamlBlockView({ blocks, descriptor });
    // Keep opaque syntax baselines inside the codec's own module instance.
    if (source !== undefined)
        baseline = parseSourceSyntax(source, { format }).baseline;
    return applySourceSyntaxEdits(baseline, [{ op: 'replace-tree', tree }]);
}
