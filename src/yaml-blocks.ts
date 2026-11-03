import type { SourceDocumentReference } from '@kubohiroya/turbowarp-document-source';
import type {
    SourceSyntaxComment,
    SourceSyntaxNode,
    SourceSyntaxPair,
    SourceSyntaxScalar,
} from './source-syntax.js';
import { yamlBlockIconURI } from './yaml-block-icon.js';
export { yamlBlockIconURI };
import {encodeReference} from '@kubohiroya/turbowarp-document-source';
import {readReference, identifier, fail} from '@kubohiroya/turbowarp-document-source/protocol';
export type {
    SourceSyntaxNode as YamlSyntaxNode,
    SourceSyntaxComment as YamlCommentNode,
    SourceSyntaxScalar as YamlScalarNode,
    SourceSyntaxPair as YamlPairNode,
} from './source-syntax.js';
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
    arguments: Record<string, { type: 'string'; defaultValue: string; menu?: string }>;
}
export type YamlBlockMenus = Record<
    'yamlScalarTypes' | 'yamlCommentPlacements' | 'yamlLineCommentPlacements' | 'yamlLineBreaks',
    { acceptReporters: false; items: string[] }
>;
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
type CommentSlot = 'before' | 'inline' | 'after';
/** Pairs appear only inside maps; the view validates every node it walks. */
type ViewNode = SourceSyntaxNode | SourceSyntaxPair;
/** A block read from an untrusted project graph. */
type GraphBlock = {
    opcode?: unknown;
    parent?: unknown;
    next?: unknown;
    shadow?: unknown;
    inputs?: Record<string, unknown>;
    fields?: Record<string, unknown>;
};

export const yamlBlockOperations = Object.freeze({
    map: 'yamlMap',
    pair: 'yamlKey',
    sequence: 'yamlSequence',
    item: 'yamlItem',
    scalar: 'yamlScalar',
    text: 'yamlText',
    textLine: 'yamlTextLine',
    comment: 'yamlComment',
    lineComment: 'yamlLineComment',
    inlineComment: 'yamlInlineComment',
} as const);
const slots: readonly CommentSlot[] = ['before', 'inline', 'after'];
const lineSlots: readonly CommentSlot[] = ['before', 'after'];
const lineBreaks: Readonly<Record<string, string>> = Object.freeze({
    LF: '\n',
    CRLF: '\r\n',
    CR: '\r',
    none: '',
});
const scalarTypes = ['string', 'number', 'boolean', 'null'];
const record = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === 'object' && !Array.isArray(value);
function invalid(message: string): never {
    fail('YAML_BLOCK_GRAPH_INVALID', message);
}
const bounded = (value: unknown): value is string =>
    typeof value === 'string' && value.length <= 1024 * 1024;
const input = (value: unknown): YamlViewInput => [1, [10, String(value)]];
const field = (value: unknown): unknown =>
    Array.isArray(value) ? value[0] : record(value) ? value.value : value;
const isSlot = (list: readonly CommentSlot[], value: string): value is CommentSlot =>
    (list as readonly string[]).includes(value);

/** Authoring declarations only: no YAML is executed by these blocks. */
export function createYamlBlockDefinitions(): YamlBlockDefinition[] {
    const text = (defaultValue: string) => ({ type: 'string', defaultValue }) as const;
    return (
        [
        {
            opcode: yamlBlockOperations.map,
            blockType: 'command',
            branchCount: 1,
            text: 'YAML map',
            arguments: {},
        },
        {
            opcode: yamlBlockOperations.pair,
            blockType: 'command',
            branchCount: 1,
            text: 'YAML key [KEY]',
            arguments: { KEY: text('key') },
        },
        {
            opcode: yamlBlockOperations.sequence,
            blockType: 'command',
            branchCount: 1,
            text: 'YAML list',
            arguments: {},
        },
        {
            opcode: yamlBlockOperations.item,
            blockType: 'command',
            branchCount: 1,
            text: 'YAML list item',
            arguments: {},
        },
        {
            opcode: yamlBlockOperations.scalar,
            blockType: 'command',
            text: 'YAML [TYPE] value [VALUE]',
            arguments: {
                TYPE: { type: 'string', menu: 'yamlScalarTypes', defaultValue: 'string' },
                VALUE: text('value'),
            },
        },
        {
            opcode: yamlBlockOperations.text,
            blockType: 'command',
            branchCount: 1,
            text: 'YAML string lines',
            arguments: {},
        },
        {
            opcode: yamlBlockOperations.textLine,
            blockType: 'command',
            text: 'YAML text line [TEXT] ending [BREAK]',
            arguments: {
                TEXT: text('line'),
                BREAK: { type: 'string', menu: 'yamlLineBreaks', defaultValue: 'LF' },
            },
        },
        {
            opcode: yamlBlockOperations.comment,
            hideFromPalette: true,
            blockType: 'command',
            text: 'YAML comment [PLACEMENT] [TEXT]',
            arguments: {
                PLACEMENT: {
                    type: 'string',
                    menu: 'yamlCommentPlacements',
                    defaultValue: 'before',
                },
                TEXT: text('comment'),
            },
        },
        {
            opcode: yamlBlockOperations.lineComment,
            blockType: 'command',
            text: 'YAML line comment [PLACEMENT] [TEXT]',
            arguments: {
                PLACEMENT: {
                    type: 'string',
                    menu: 'yamlLineCommentPlacements',
                    defaultValue: 'before',
                },
                TEXT: text('comment'),
            },
        },
        {
            opcode: yamlBlockOperations.inlineComment,
            blockType: 'command',
            text: 'YAML inline comment [TEXT]',
            arguments: { TEXT: text('comment') },
        },
        ] satisfies Omit<YamlBlockDefinition, 'blockIconURI'>[]
    ).map((definition) => ({ ...definition, blockIconURI: yamlBlockIconURI }));
}
export function createYamlBlockMenus(): YamlBlockMenus {
    return {
        yamlScalarTypes: { acceptReporters: false, items: scalarTypes.slice() },
        yamlCommentPlacements: { acceptReporters: false, items: slots.slice() },
        yamlLineCommentPlacements: { acceptReporters: false, items: lineSlots.slice() },
        yamlLineBreaks: { acceptReporters: false, items: Object.keys(lineBreaks) },
    };
}
export function createYamlBlockOpcodes(
    prefix = 'kubohiroyaembeddedyaml_',
): Readonly<Required<YamlBlockOpcodes>> {
    identifier(prefix, 'opcode prefix');
    return Object.freeze(
        Object.fromEntries(
            Object.entries(yamlBlockOperations).map(([kind, operation]) => [
                kind,
                `${prefix}${operation}`,
            ]),
        ) as Required<YamlBlockOpcodes>,
    );
}

/** Build a derived view. The caller owns installation, source and transaction baselines. */
export function createYamlBlockView({
    reference,
    tree,
    rootId,
    rootOpcode,
    opcodes = createYamlBlockOpcodes(),
    idPrefix = 'yaml-view-',
    x = 32,
    y = 32,
}: YamlBlockViewOptions): YamlBlockView {
    identifier(rootId, 'root block ID');
    identifier(rootOpcode, 'root opcode');
    identifier(idPrefix, 'view ID prefix');
    if ((tree as ViewNode | undefined)?.kind === 'pair')
        invalid('A YAML document cannot be a standalone key/value pair.');
    const encoded = encodeReference(reference),
        blocks: Record<string, YamlViewBlock> = {},
        nodeIds: Record<string, string> = {},
        keyIds: Record<string, string> = {};
    const syntaxIds = new Set<string>();
    let serial = 0;
    const checkNode = (node: unknown): void => {
        if (!record(node) || !bounded(node.id) || !node.id || syntaxIds.has(node.id))
            invalid('Syntax nodes must have unique nonempty IDs.');
        syntaxIds.add(node.id);
        if (syntaxIds.size > 50000) invalid('The YAML view has too many nodes.');
    };
    const add = (
        kind: keyof YamlBlockOpcodes,
        values: Record<string, unknown> = {},
        direct: Record<string, string> = {},
        node?: { id: string },
    ): string => {
        if (serial >= 99999) invalid('The YAML view exceeds its block limit.');
        const id = `${idPrefix}${++serial}`;
        if (id === rootId) invalid('The view prefix collides with its root.');
        blocks[id] = {
            opcode: opcodes[kind] as string,
            next: null,
            parent: null,
            inputs: Object.fromEntries(
                Object.entries(values).map(([name, value]) => [name, input(value)]),
            ),
            fields: Object.fromEntries(
                Object.entries(direct).map(([name, value]) => [name, [value, null]]),
            ),
            shadow: false,
            topLevel: false,
        };
        if (node) nodeIds[id] = node.id;
        return id;
    };
    const chain = (ids: string[]): string | null => {
        for (let i = 1; i < ids.length; i++) {
            blocks[ids[i - 1]!]!.next = ids[i]!;
            blocks[ids[i]!]!.parent = ids[i - 1]!;
        }
        return ids[0] || null;
    };
    const branch = (parent: string, ids: string[]): void => {
        const first = chain(ids);
        if (first) {
            blocks[parent]!.inputs.SUBSTACK = [2, first];
            blocks[first]!.parent = parent;
        }
    };
    const comments = (node: ViewNode, slot: CommentSlot): string[] => {
        const list = node.comments?.[slot] || [];
        if (!Array.isArray(list)) invalid('Comment groups must be arrays.');
        return list.map((comment: SourceSyntaxComment) => {
            checkNode(comment);
            if (
                comment.kind !== 'comment' ||
                !bounded(comment.text) ||
                /[\r\n]/u.test(comment.text)
            )
                invalid('Invalid YAML comment.');
            const kind =
                slot === 'inline' && opcodes.inlineComment
                    ? 'inlineComment'
                    : slot !== 'inline' && opcodes.lineComment
                      ? 'lineComment'
                      : 'comment';
            return add(
                kind,
                { TEXT: comment.text },
                kind === 'inlineComment' ? {} : { PLACEMENT: slot },
                comment,
            );
        });
    };
    const emit = (node: ViewNode, depth = 0): string[] => {
        if (depth > 64) invalid('The YAML view is too deeply nested.');
        checkNode(node);
        const before = comments(node, 'before');
        let id: string;
        if (node.kind === 'scalar') {
            const value = node.value;
            const type = value === null ? 'null' : typeof value;
            if (!scalarTypes.includes(type) || (type === 'number' && !Number.isFinite(value)))
                invalid('Only finite JSON-compatible scalar values are supported.');
            if (typeof value === 'string' && /[\r\n]/u.test(value)) {
                id = add('text', {}, {}, node);
                const parts = value.split(/(\r\n|\r|\n)/u),
                    lines: string[] = [];
                for (let i = 0; i < parts.length; i += 2) {
                    const ending = Object.entries(lineBreaks).find(
                        ([, value]) => value === (parts[i + 1] || ''),
                    )![0];
                    lines.push(add('textLine', { TEXT: parts[i] }, { BREAK: ending }));
                }
                branch(id, lines);
            } else
                id = add(
                    'scalar',
                    { VALUE: value === null ? 'null' : String(value) },
                    { TYPE: type },
                    node,
                );
        } else if (node.kind === 'map') {
            if (
                !Array.isArray(node.entries) ||
                node.entries.some((entry) => entry?.kind !== 'pair')
            )
                invalid('Maps contain key/value pairs only.');
            id = add('map', {}, {}, node);
            branch(
                id,
                node.entries.flatMap((entry) => emit(entry, depth + 1)),
            );
        } else if (node.kind === 'pair') {
            checkNode(node.key);
            if (
                node.key.kind !== 'scalar' ||
                typeof node.key.value !== 'string' ||
                /[\r\n]/u.test(node.key.value)
            )
                invalid('Map keys must be literal strings.');
            if (node.key.comments && slots.some((slot) => node.key.comments![slot]?.length))
                fail(
                    'YAML_BLOCK_UNSUPPORTED',
                    'Comments attached to a key must be normalized onto its pair.',
                );
            id = add('pair', { KEY: node.key.value }, {}, node);
            keyIds[id] = node.key.id;
            branch(id, emit(node.value, depth + 1));
        } else if (node.kind === 'sequence') {
            if (!Array.isArray(node.items)) invalid('Lists require an item array.');
            id = add('sequence', {}, {}, node);
            branch(
                id,
                node.items.map((item) => {
                    const wrapper = add('item');
                    branch(wrapper, emit(item, depth + 1));
                    return wrapper;
                }),
            );
        } else invalid('Unknown YAML syntax node.');
        return [...before, id, ...comments(node, 'inline'), ...comments(node, 'after')];
    };
    blocks[rootId] = {
        opcode: rootOpcode,
        next: null,
        parent: null,
        inputs: {},
        fields: { DOCUMENT: [encoded, null] },
        shadow: false,
        topLevel: true,
        x,
        y,
    };
    const first = chain(emit(tree));
    if (first) {
        blocks[rootId]!.next = first;
        blocks[first]!.parent = rootId;
    }
    const syntaxIdsByPath: Record<string, string> = {};
    walkSyntax(tree, (node, path) => {
        syntaxIdsByPath[path] = node.id;
    });
    return {
        blocks,
        rootId,
        nodeIds,
        keyIds,
        descriptor: {
            version: 2,
            reference: { ...reference },
            rootOpcode,
            opcodes: { ...opcodes },
            syntaxIdsByPath,
        },
    };
}

/** Read literal data only; unknown blocks and reporters never execute during conversion. */
export function readYamlBlockView({
    blocks,
    descriptor,
}: {
    blocks: Readonly<Record<string, unknown>>;
    descriptor: YamlViewDescriptor;
}): SourceSyntaxNode {
    if (!record(blocks) || !record(descriptor) || descriptor.version !== 2)
        invalid('A known YAML view descriptor is required.');
    const { rootOpcode, opcodes, syntaxIdsByPath = {} } = descriptor;
    const matching = Object.entries(blocks).filter(([, block]) => {
        if ((block as GraphBlock | null | undefined)?.opcode !== rootOpcode) return false;
        try {
            return (
                encodeReference(readReference(block, { blocks })) ===
                encodeReference(descriptor.reference)
            );
        } catch {
            return false;
        }
    });
    if (matching.length !== 1) invalid('Exactly one root must reference this document.');
    const [rootId, root] = matching[0]! as [string, GraphBlock];
    if (root.parent !== null) invalid('The document view root is connected to another block.');
    const seen = new Set([rootId]),
        syntaxIds = new Set<string>();
    const get = (id: unknown): GraphBlock => {
        if (typeof id !== 'string' || !record(blocks[id]) || seen.has(id))
            invalid('The YAML graph is missing a block, cyclic or shared.');
        seen.add(id);
        if (seen.size > 100000) invalid('The YAML graph exceeds its block limit.');
        return blocks[id] as GraphBlock;
    };
    const rawLiteral = (block: GraphBlock, name: string): string => {
        if (Object.hasOwn(block.fields || {}, name)) {
            const value = field(block.fields![name]);
            if (!bounded(value)) invalid('Literal fields must contain bounded text.');
            return value;
        }
        const value = block.inputs?.[name];
        if (Array.isArray(value)) {
            if (
                value[0] !== 1 ||
                !Array.isArray(value[1]) ||
                ![4, 5, 6, 7, 8, 10].includes(value[1][0])
            )
                invalid('Reporter inputs are not permitted in YAML data views.');
            if (!['string', 'number'].includes(typeof value[1][1]) || !bounded(String(value[1][1])))
                invalid('Invalid literal value.');
            return String(value[1][1]);
        }
        if (!record(value) || !value.shadow || value.block !== value.shadow)
            invalid('Reporter inputs are not permitted in YAML data views.');
        const shadow = get(value.shadow);
        if (
            shadow.shadow !== true ||
            ![
                'text',
                'math_number',
                'math_integer',
                'math_whole_number',
                'math_positive_number',
                'math_angle',
            ].includes(shadow.opcode as string)
        )
            invalid('Literal inputs require known text or number shadow blocks.');
        const values = Object.values(shadow.fields || {});
        if (values.length !== 1) invalid('A literal input has ambiguous fields.');
        const text = field(values[0]);
        if (!bounded(String(text))) invalid('A literal input is too large.');
        return String(text);
    };
    const literal = (block: GraphBlock, name: string): string => {
        const value = rawLiteral(block, name);
        if (/[\r\n]/u.test(value))
            fail('YAML_BLOCK_UNSUPPORTED', 'Multiline content requires explicit line blocks.');
        return value;
    };
    const textValue = (first: unknown, parent: string): string => {
        let id = first,
            previous: unknown = parent,
            value = '',
            count = 0;
        while (id !== null && id !== undefined) {
            const block = get(id);
            if (
                block.opcode !== opcodes.textLine ||
                block.parent !== previous ||
                Object.keys(block.inputs || {}).some((name) => !['TEXT', 'BREAK'].includes(name)) ||
                Object.keys(block.fields || {}).some((name) => !['TEXT', 'BREAK'].includes(name))
            )
                invalid('String bodies contain literal text-line blocks only.');
            const ending = literal(block, 'BREAK');
            if (!Object.hasOwn(lineBreaks, ending)) invalid('Unknown text line ending.');
            value += literal(block, 'TEXT') + lineBreaks[ending];
            count++;
            previous = id;
            id = block.next;
        }
        if (!count) invalid('A multiline string requires at least one text line.');
        return value;
    };
    const substack = (block: GraphBlock): string | null => {
        const branch = block.inputs?.SUBSTACK;
        if (branch === undefined) return null;
        if (Array.isArray(branch)) {
            if (branch[0] !== 2 || typeof branch[1] !== 'string')
                invalid('Invalid YAML body connection.');
            return branch[1];
        }
        if (!record(branch) || typeof branch.block !== 'string' || branch.shadow)
            invalid('Invalid YAML body connection.');
        return branch.block;
    };
    const identity = (id: string, key = false): string => {
        const value = `block:${id}${key ? ':key' : ''}`;
        if (!bounded(value) || !value || syntaxIds.has(value))
            invalid('Syntax IDs in this view are invalid or repeated.');
        syntaxIds.add(value);
        return value;
    };
    const addComments = (node: ViewNode, slot: CommentSlot, comments: SourceSyntaxComment[]) => {
        if (comments.length) {
            node.comments ||= {};
            (node.comments[slot] ||= []).push(...comments);
        }
    };
    const parseChain = (
        first: unknown,
        parent: string,
        depth: number,
        context: 'map' | 'sequence' | 'value',
    ): ViewNode[] => {
        if (depth > 64) invalid('The YAML view is too deeply nested.');
        const result: ViewNode[] = [];
        let id = first,
            previous: unknown = parent,
            pendingBefore: SourceSyntaxComment[] = [];
        while (id !== null && id !== undefined) {
            const block = get(id);
            const legacyComment = block.opcode === opcodes.comment;
            const lineComment =
                typeof opcodes.lineComment === 'string' && block.opcode === opcodes.lineComment;
            const inlineComment =
                typeof opcodes.inlineComment === 'string' && block.opcode === opcodes.inlineComment;
            const allowed =
                block.opcode === opcodes.scalar
                    ? ['TYPE', 'VALUE']
                    : legacyComment || lineComment
                      ? ['PLACEMENT', 'TEXT']
                      : inlineComment
                        ? ['TEXT']
                        : block.opcode === opcodes.pair
                          ? ['KEY', 'SUBSTACK']
                          : ['SUBSTACK'];
            if (
                Object.keys(block.inputs || {}).some((name) => !allowed.includes(name)) ||
                Object.keys(block.fields || {}).some((name) => !allowed.includes(name))
            )
                invalid('The YAML block contains unknown inputs or fields.');
            if (block.parent !== previous) invalid('The YAML block parent links are inconsistent.');
            if (legacyComment || lineComment || inlineComment) {
                const slot = inlineComment ? 'inline' : literal(block, 'PLACEMENT'),
                    text = literal(block, 'TEXT');
                if (!isSlot(lineComment ? lineSlots : slots, slot))
                    invalid('Unknown YAML comment placement.');
                const comment: SourceSyntaxComment = { id: identity(id as string), kind: 'comment', text };
                if (slot === 'before') pendingBefore.push(comment);
                else {
                    if (!result.length) invalid('Inline/after comments require a preceding node.');
                    addComments(result.at(-1)!, slot, [comment]);
                }
            } else {
                let node: ViewNode;
                const blockId = id as string,
                    nextDepth = depth + 1;
                if (block.opcode === opcodes.map) {
                    node = {
                        id: identity(blockId),
                        kind: 'map',
                        entries: parseChain(
                            substack(block),
                            blockId,
                            nextDepth,
                            'map',
                        ) as SourceSyntaxPair[],
                    };
                } else if (block.opcode === opcodes.pair) {
                    if (context !== 'map') invalid('YAML keys must be inside a map.');
                    const values = parseChain(substack(block), blockId, nextDepth, 'value');
                    if (values.length !== 1) invalid('Each YAML key needs exactly one value.');
                    node = {
                        id: identity(blockId),
                        kind: 'pair',
                        key: {
                            id: identity(blockId, true),
                            kind: 'scalar',
                            value: literal(block, 'KEY'),
                        },
                        value: values[0] as SourceSyntaxNode,
                    };
                } else if (block.opcode === opcodes.sequence) {
                    node = {
                        id: identity(blockId),
                        kind: 'sequence',
                        items: parseChain(
                            substack(block),
                            blockId,
                            nextDepth,
                            'sequence',
                        ) as SourceSyntaxNode[],
                    };
                } else if (block.opcode === opcodes.item) {
                    if (context !== 'sequence') invalid('List items must be inside a list.');
                    const values = parseChain(substack(block), blockId, nextDepth, 'value');
                    if (values.length !== 1) invalid('Each list item needs exactly one value.');
                    node = values[0]!;
                } else if (block.opcode === opcodes.text) {
                    node = {
                        id: identity(blockId),
                        kind: 'scalar',
                        value: textValue(substack(block), blockId),
                    };
                } else if (block.opcode === opcodes.scalar) {
                    const type = literal(block, 'TYPE'),
                        text = literal(block, 'VALUE');
                    let value: SourceSyntaxScalar['value'];
                    if (type === 'string') value = text;
                    else if (type === 'null' && text === 'null') value = null;
                    else if (type === 'boolean' && (text === 'true' || text === 'false'))
                        value = text === 'true';
                    else if (
                        type === 'number' &&
                        /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/u.test(text) &&
                        Number.isFinite(Number(text))
                    )
                        value = Number(text);
                    else invalid('The scalar value does not match its declared type.');
                    node = { id: identity(blockId), kind: 'scalar', value };
                } else invalid('This YAML view contains an unknown block.');
                if (context === 'map' && node.kind !== 'pair') invalid('Maps contain keys only.');
                if (context === 'sequence' && block.opcode !== opcodes.item)
                    invalid('Lists contain item wrappers only.');
                if (context === 'value' && node.kind === 'pair')
                    invalid('A key cannot stand alone as a value.');
                addComments(node, 'before', pendingBefore);
                pendingBefore = [];
                result.push(node);
            }
            previous = id;
            id = block.next;
        }
        if (pendingBefore.length) invalid('A before-comment is not followed by a node.');
        return result;
    };
    const nodes = parseChain(root.next, rootId, 0, 'value');
    if (nodes.length !== 1) invalid('A YAML document view needs exactly one root value.');
    const mapped = new Set();
    walkSyntax(nodes[0]!, (node, path) => {
        const id = syntaxIdsByPath[path] || `view:${path}`;
        if (!bounded(id) || !id || mapped.has(id))
            invalid('The syntax path identity map is invalid.');
        mapped.add(id);
        node.id = id;
    });
    return nodes[0] as SourceSyntaxNode;
}

function walkSyntax(
    node: ViewNode,
    visit: (node: ViewNode | SourceSyntaxComment, path: string) => void,
    path = '$',
): void {
    visit(node, path);
    for (const slot of slots)
        for (const [index, comment] of (node.comments?.[slot] || []).entries())
            visit(comment, `${path}/comments/${slot}/${index}`);
    if (node.kind === 'map')
        node.entries.forEach((entry, index) =>
            walkSyntax(entry, visit, `${path}/entries/${index}`),
        );
    else if (node.kind === 'sequence')
        node.items.forEach((item, index) => walkSyntax(item, visit, `${path}/items/${index}`));
    else if (node.kind === 'pair') {
        walkSyntax(node.key, visit, `${path}/key`);
        walkSyntax(node.value, visit, `${path}/value`);
    }
}
