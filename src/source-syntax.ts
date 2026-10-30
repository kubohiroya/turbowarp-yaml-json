import {Pair, Scalar, isMap, isSeq, isScalar, parseDocument} from 'yaml';
import {parseValue, PARSE_LIMITS, type DataValue, type ParseFormat} from './codec.js';

// The yaml library's heterogeneous Document/Pair/Node graph is private; validate
// every portable input before crossing this internal AST bridge.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type NativeSyntax = any;

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
export type SourceSyntaxNode =
  | SourceSyntaxScalar
  | (Base & {kind: 'map'; entries: SourceSyntaxPair[]})
  | (Base & {kind: 'sequence'; items: SourceSyntaxNode[]});
export interface SourceSyntaxBaseline {
  readonly sourceSyntaxBaseline: true;
}
export interface SourceSyntaxResult {
  baseline: SourceSyntaxBaseline;
  format: 'yaml' | 'json';
  tree: SourceSyntaxNode;
}
export class SourceSyntaxError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'SourceSyntaxError';
  }
}
// Syntax handles are capabilities, not serializable copies of the owner's source.
const baselines = new WeakMap<
  SourceSyntaxBaseline,
  {
    source: string;
    format: 'yaml' | 'json';
    doc: NativeSyntax;
    tree: SourceSyntaxNode;
    nodes: Map<string, NativeSyntax>;
    origins: Map<string, {id: string; property: string; text: string}>;
  }
>();
const fail = (code: string, message: string): never => {
  throw new SourceSyntaxError(code, message);
};
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const canonical = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical((value as Record<string, unknown>)[key])])
    );
  return value;
};
const same = (a: unknown, b: unknown) =>
  JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
const treeWithoutEmptyComments = (tree: SourceSyntaxNode): unknown => {
  const visit = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(visit);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(
      Object.entries(value)
        .filter(
          ([key, item]) =>
            key !== 'comments' ||
            (item &&
              typeof item === 'object' &&
              Object.values(item).some((group) => Array.isArray(group) && group.length))
        )
        .map(([key, item]) => [key, visit(item)])
    );
  };
  return visit(tree);
};
export function parseSourceSyntax(
  source: string,
  options: {format?: ParseFormat} = {}
): SourceSyntaxResult {
  const checked = parseValue(source, options.format ?? 'auto');
  if (!checked.success) fail('SOURCE_INVALID', checked.diagnostic.message);
  const doc = parseDocument(source, {keepSourceTokens: true, uniqueKeys: true});
  if (doc.errors.length) fail('SOURCE_INVALID', doc.errors[0]!.message);
  let next = 0,
    commentNext = 0;
  const nodes = new Map<string, NativeSyntax>(),
    origins = new Map<string, {id: string; property: string; text: string}>();
  const comments = (target: Base, node: NativeSyntax, originId: string) => {
    for (const property of ['commentBefore', 'comment']) {
      if (typeof node?.[property] !== 'string') continue;
      const inline =
        property === 'comment' &&
        isScalar(node) &&
        node.range &&
        !/[\r\n]/u.test(source.slice(node.range[1], source.indexOf('#', node.range[1])));
      const place = property === 'commentBefore' ? 'before' : inline ? 'inline' : 'after';
      (target.comments ??= {})[place] ??= [];
      // yaml retains CRLF in some document-tail comments but normalizes other groups.
      // Every field-backed comment node must contain exactly one line.
      for (const text of node[property].replace(/\r\n?/gu, '\n').split('\n')) {
        const id = `comment:${commentNext++}`;
        target.comments[place]!.push({id, kind: 'comment', text});
        origins.set(id, {id: originId, property, text});
      }
    }
  };
  const visit = (node: NativeSyntax): SourceSyntaxNode => {
    const id = `node:${next++}`;
    nodes.set(id, node);
    let tree: SourceSyntaxNode;
    if (isMap(node))
      tree = {
        id,
        kind: 'map',
        entries: node.items.map((pair) => {
          if (!isScalar(pair.key) || typeof pair.key.value !== 'string')
            fail('KEY_UNSUPPORTED', 'Map keys must be strings.');
          const pairId = `node:${next++}`;
          nodes.set(pairId, pair);
          const keyId = `node:${next++}`;
          nodes.set(keyId, pair.key);
          const result: SourceSyntaxPair = {
            id: pairId,
            kind: 'pair',
            key: {id: keyId, kind: 'scalar', value: (pair.key as Scalar<string>).value},
            value: visit(pair.value)
          };
          comments(result, pair.key, keyId);
          return result;
        })
      };
    else if (isSeq(node)) tree = {id, kind: 'sequence', items: node.items.map(visit)};
    else {
      const value = isScalar(node) ? node.value : null;
      if (value !== null && !['string', 'number', 'boolean'].includes(typeof value))
        fail('SCALAR_UNSUPPORTED', 'Only JSON scalar values are supported.');
      tree = {id, kind: 'scalar', value: value as SourceSyntaxScalar['value']};
    }
    comments(tree, node, id);
    return tree;
  };
  const tree = visit(doc.contents);
  comments(tree, doc, 'document');
  const baseline = Object.freeze({sourceSyntaxBaseline: true as const});
  baselines.set(baseline, {source, format: checked.format, doc, tree: clone(tree), nodes, origins});
  return {baseline, format: checked.format, tree};
}
function validateTree(tree: SourceSyntaxNode): void {
  let count = 0;
  const seen = new Set<string>(),
    objects = new Set<object>();
  const walk = (node: NativeSyntax, depth: number, pair = false, key = false): void => {
    if (
      !node ||
      typeof node !== 'object' ||
      objects.has(node) ||
      depth > PARSE_LIMITS.maxDepth ||
      (!pair && !key && ++count > PARSE_LIMITS.maxNodes) ||
      objects.size > PARSE_LIMITS.maxNodes * 3
    )
      fail('TREE_INVALID', 'Syntax tree exceeds its structural limits.');
    objects.add(node);
    if (typeof node.id !== 'string' || !node.id.length || node.id.length > 256 || seen.has(node.id))
      fail('TREE_INVALID', 'Syntax identities must be unique bounded strings.');
    seen.add(node.id);
    const allowed = [
      'id',
      'kind',
      'comments',
      ...(node.kind === 'scalar'
        ? ['value']
        : node.kind === 'map'
          ? ['entries']
          : node.kind === 'sequence'
            ? ['items']
            : node.kind === 'pair'
              ? ['key', 'value']
              : [])
    ];
    if (Object.keys(node).some((k) => !allowed.includes(k)))
      fail('TREE_INVALID', 'Unknown syntax property.');
    if (node.comments !== undefined) {
      if (
        !node.comments ||
        typeof node.comments !== 'object' ||
        Object.keys(node.comments).some((k) => !['before', 'inline', 'after'].includes(k))
      )
        fail('TREE_INVALID', 'Invalid comment placement.');
      for (const group of Object.values(node.comments) as NativeSyntax[]) {
        if (!Array.isArray(group)) fail('TREE_INVALID', 'Comments must be arrays.');
        for (const c of group) {
          if (
            !c ||
            c.kind !== 'comment' ||
            typeof c.text !== 'string' ||
            /[\r\n]/u.test(c.text) ||
            typeof c.id !== 'string' ||
            seen.has(c.id) ||
            Object.keys(c).some((k) => !['id', 'kind', 'text'].includes(k))
          )
            fail('TREE_INVALID', 'Invalid comment.');
          seen.add(c.id);
        }
      }
    }
    if (node.kind === 'scalar') {
      if (
        (node.value !== null && !['string', 'number', 'boolean'].includes(typeof node.value)) ||
        (typeof node.value === 'number' && !Number.isFinite(node.value))
      )
        fail('TREE_INVALID', 'Invalid scalar.');
    } else if (node.kind === 'map' && Array.isArray(node.entries)) {
      const keys = new Set<string>();
      for (const p of node.entries) {
        if (
          p?.kind !== 'pair' ||
          p.key?.kind !== 'scalar' ||
          typeof p.key.value !== 'string' ||
          p.key.comments ||
          keys.has(p.key.value)
        )
          fail('TREE_INVALID', 'Map keys must be unique strings without separate comments.');
        keys.add(p.key.value);
        walk(p, depth, true);
      }
    } else if (node.kind === 'sequence' && Array.isArray(node.items)) {
      for (const item of node.items) walk(item, depth + 1);
    } else if (node.kind === 'pair' && pair) {
      walk(node.key, depth, false, true);
      walk(node.value, depth + 1);
    } else fail('TREE_INVALID', 'Unknown syntax node kind.');
  };
  walk(tree, 0);
  if (new TextEncoder().encode(JSON.stringify(tree)).byteLength > PARSE_LIMITS.maxInputBytes * 8)
    fail('TREE_INVALID', 'Syntax tree is too large.');
}
function valueOf(node: SourceSyntaxNode): DataValue {
  if (node.kind === 'scalar') return node.value;
  if (node.kind === 'sequence') return node.items.map(valueOf);
  const value: Record<string, DataValue> = Object.create(null);
  for (const pair of node.entries)
    Object.defineProperty(value, pair.key.value as string, {
      value: valueOf(pair.value),
      enumerable: true
    });
  return value;
}
export function applySourceSyntaxEdits(
  baseline: SourceSyntaxBaseline,
  edits: readonly {op: 'replace-tree'; tree: SourceSyntaxNode}[]
): {source: string; format: 'yaml' | 'json'; tree: SourceSyntaxNode} {
  const state = baselines.get(baseline);
  if (!state)
    throw new SourceSyntaxError('BASELINE_INVALID', 'An original syntax baseline is required.');
  if (!Array.isArray(edits) || edits.length !== 1 || edits[0]?.op !== 'replace-tree')
    fail('EDIT_INVALID', 'Exactly one replacement tree is required.');
  const tree = edits[0]!.tree;
  validateTree(tree);
  if (same(treeWithoutEmptyComments(tree), treeWithoutEmptyComments(state.tree)))
    return {source: state.source, format: state.format, tree: clone(tree)};
  const doc = state.doc.clone();
  doc.commentBefore = null;
  doc.comment = null;
  const allComments = (node: NativeSyntax): boolean =>
    Boolean(node.comments && Object.values(node.comments).some((a: NativeSyntax) => a.length)) ||
    (node.kind === 'map'
      ? node.entries.some(
          (p: NativeSyntax) => allComments(p) || allComments(p.key) || allComments(p.value)
        )
      : node.kind === 'sequence'
        ? node.items.some(allComments)
        : false);
  if (state.format === 'json' && allComments(tree))
    fail('JSON_COMMENTS_UNSUPPORTED', 'JSON source cannot contain YAML comments.');
  const clear = (node: NativeSyntax) => {
    if (node) {
      node.commentBefore = undefined;
      node.comment = undefined;
    }
  };
  const applyComments = (target: NativeSyntax, source: Base) => {
    // An edited/new empty comment is a real '#' line, not the absence of a comment.
    // Existing empty inter-comment gaps keep their original blank-line semantics.
    const text = (comment: SourceSyntaxComment) =>
      comment.text === '' && state.origins.get(comment.id)?.text !== '' ? ' ' : comment.text;
    const before = source.comments?.before?.map(text).join('\n');
    const inline = source.comments?.inline?.map(text).join('\n');
    const after = source.comments?.after?.map(text).join('\n');
    if (before !== undefined) target.commentBefore = before;
    if (inline !== undefined || after !== undefined)
      target.comment = [inline, after === undefined ? undefined : `\n${after}`]
        .filter((v) => v !== undefined)
        .join('\n');
  };
  const build = (node: SourceSyntaxNode): NativeSyntax => {
    const original = state.nodes.get(node.id);
    let result: NativeSyntax;
    if (node.kind === 'scalar') {
      result = isScalar(original) ? original.clone() : new Scalar(node.value);
      result.value = node.value;
      if (state.format === 'json' && typeof node.value === 'string')
        result.type = Scalar.QUOTE_DOUBLE;
    } else if (node.kind === 'map') {
      result = isMap(original) ? original.clone() : doc.createNode({});
      result.items = node.entries.map((p) => {
        const key = build(p.key),
          value = build(p.value);
        applyComments(key, {
          id: p.id,
          comments: p.comments?.before ? {before: p.comments.before} : undefined
        } as Base);
        applyComments(value, {
          id: p.id,
          comments: {
            ...(p.comments?.inline ? {inline: p.comments.inline} : {}),
            ...(p.comments?.after ? {after: p.comments.after} : {})
          }
        });
        return new Pair(key, value);
      });
    } else {
      result = isSeq(original) ? original.clone() : doc.createNode([]);
      result.items = node.items.map(build);
    }
    clear(result);
    applyComments(result, node);
    if (state.format === 'json' && (isMap(result) || isSeq(result))) result.flow = true;
    return result;
  };
  doc.contents = build(tree);
  let source = doc.toString({lineWidth: 0});
  // YAML's emitter omits a source BOM; preserve the owner's original file prefix.
  if (state.source.startsWith('\ufeff') && !source.startsWith('\ufeff')) source = '\ufeff' + source;
  if (state.format === 'json') {
    // Flow nodes and double-quoted keys use the library's JSON-compatible emitter.
    if (!parseValue(source, 'json').success)
      fail(
        'JSON_EMISSION_UNSUPPORTED',
        'The edited JSON tree cannot be emitted without changing its native format.'
      );
  }
  if (state.source.includes('\r\n') && !state.source.replace(/\r\n/g, '').includes('\n'))
    source = source.replace(/\n/g, '\r\n');
  const checked = parseValue(source, state.format);
  if (!checked.success || !same(checked.value, valueOf(tree)))
    fail('EMISSION_INVALID', 'Edited syntax does not match the emitted document.');
  return {source, format: state.format, tree: clone(tree)};
}
