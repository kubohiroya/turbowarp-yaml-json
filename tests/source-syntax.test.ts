import {describe, it, expect} from 'vitest';
import {
  parseSourceSyntax,
  applySourceSyntaxEdits,
  SourceSyntaxError,
  type SourceSyntaxBaseline,
  type SourceSyntaxNode
} from '../src/source-syntax.js';
const copy = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const replace = (baseline: SourceSyntaxBaseline, tree: SourceSyntaxNode) =>
  applySourceSyntaxEdits(baseline, [{op: 'replace-tree', tree}]);
describe('source syntax owner boundary', () => {
  it('preserves the original BOM and CRLF after a semantic scalar edit', () => {
    const source = '\ufeff# original file\r\nvalue: one\r\n';
    const parsed = parseSourceSyntax(source);
    expect(replace(parsed.baseline, copy(parsed.tree)).source).toBe(source);
    const tree = copy(parsed.tree);
    if (tree.kind !== 'map' || tree.entries[0]!.value.kind !== 'scalar') throw Error();
    tree.entries[0]!.value.value = 'two';
    const output = replace(parsed.baseline, tree).source;
    expect(output.startsWith('\ufeff# original file\r\n')).toBe(true);
    expect(output).toContain('value: two\r\n');
    expect(output.match(/\ufeff/g)).toHaveLength(1);
  });

  it('preserves untouched CRLF, quote styles, ordering, and comments byte for byte with deterministic IDs', () => {
    const source =
      '# leading\r\nname: "Student" # inline\r\nitems:\r\n  - one # item\r\n  # before two\r\n  - two\r\n# trailing\r\n';
    const first = parseSourceSyntax(source);
    const second = parseSourceSyntax(source);
    expect(first.tree).toEqual(second.tree);
    expect(replace(first.baseline, copy(first.tree)).source).toBe(source);
  });
  it('edits an actual string and preserves all comment text through collection edits', () => {
    const parsed = parseSourceSyntax(
      '# lead\nname: "Student" # inline\nitems:\n  # before item\n  - one\n# tail\n'
    );
    const tree = copy(parsed.tree);
    if (tree.kind !== 'map') throw Error();
    if (tree.entries[0]!.value.kind !== 'scalar') throw Error();
    tree.entries[0]!.value.value = 'Teacher';
    const sequence = tree.entries[1]!.value;
    if (sequence.kind !== 'sequence') throw Error();
    sequence.items.push({id: 'block:new', kind: 'scalar', value: 'two'});
    const output = replace(parsed.baseline, tree);
    expect(output.source).toContain('Teacher');
    for (const text of ['lead', 'inline', 'before item', 'tail'])
      expect(output.source).toContain(`# ${text}`);
    expect(parseSourceSyntax(output.source).tree.kind).toBe('map');
  });
  it('edits keys, comments, node type, and map order through YAML nodes', () => {
    const parsed = parseSourceSyntax('one: 1 # old\ntwo: [a, b]\n');
    const tree = copy(parsed.tree);
    if (tree.kind !== 'map') throw Error();
    tree.entries[0]!.key.value = 'renamed';
    tree.entries[0]!.value = {
      id: 'block:seq',
      kind: 'sequence',
      items: [{id: 'block:item', kind: 'scalar', value: true}],
      comments: {before: [{id: 'block:comment', kind: 'comment', text: ' new'}]}
    };
    tree.entries.reverse();
    const out = replace(parsed.baseline, tree);
    expect(out.source.indexOf('two')).toBeLessThan(out.source.indexOf('renamed'));
    expect(out.source).toContain('# new');
  });
  it('keeps scalar native JSON edits valid and refuses comments in JSON', () => {
    const parsed = parseSourceSyntax('{"name":"Student","count":2}\r\n', {format: 'json'});
    expect(replace(parsed.baseline, copy(parsed.tree)).source).toBe(
      '{"name":"Student","count":2}\r\n'
    );
    const tree = copy(parsed.tree);
    if (tree.kind !== 'map' || tree.entries[0]!.value.kind !== 'scalar') throw Error();
    tree.entries[0]!.value.value = 'Teacher';
    expect(JSON.parse(replace(parsed.baseline, tree).source).name).toBe('Teacher');
    tree.comments = {before: [{id: 'new-comment', kind: 'comment', text: ' no'}]};
    expect(() => replace(parsed.baseline, tree)).toThrowError(/JSON source/);
  });
  it('refuses aliases, duplicate YAML keys, invalid syntax, forged baselines and duplicate tree ids', () => {
    for (const source of ['a: &a [1]\nb: *a\n', 'a: 1\na: 2', 'a: ['])
      expect(() => parseSourceSyntax(source)).toThrow(SourceSyntaxError);
    const parsed = parseSourceSyntax('a: 1\n');
    expect(() => replace({sourceSyntaxBaseline: true}, parsed.tree)).toThrow(/baseline/);
    const tree = copy(parsed.tree);
    if (tree.kind !== 'map') throw Error();
    tree.entries[0]!.key.id = tree.id;
    expect(() => replace(parsed.baseline, tree)).toThrow(/unique/);
  });
  it('preserves explicit comments when adding a new pair, multiline strings and null items', () => {
    const parsed = parseSourceSyntax('items:\n  -\nmessage: |\n  first\n  second\n');
    const tree = copy(parsed.tree);
    if (tree.kind !== 'map') throw Error();
    tree.entries.push({
      id: 'block:pair',
      kind: 'pair',
      key: {id: 'block:key', kind: 'scalar', value: 'added'},
      value: {id: 'block:value', kind: 'scalar', value: 'line\nnext'},
      comments: {before: [{id: 'block:before', kind: 'comment', text: ' added comment'}]}
    });
    const out = replace(parsed.baseline, tree);
    expect(out.source).toContain('# added comment');
    expect(out.source).toContain('next');
  });
  it('accepts the same maximum nesting boundary as the bounded codec', () => {
    const source =
      Array.from({length: 63}, (_, i) => '  '.repeat(i) + 'level:\n').join('') +
      '  '.repeat(63) +
      'value: 1\n';
    const parsed = parseSourceSyntax(source);
    expect(replace(parsed.baseline, parsed.tree).source).toBe(source);
  });
  it('recognizes unchanged reconstructed trees independently of object field order and empty comment groups', () => {
    const source = 'value: "kept"\r\n';
    const parsed = parseSourceSyntax(source);
    const reverse = (value: unknown): unknown =>
      Array.isArray(value)
        ? value.map(reverse)
        : value && typeof value === 'object'
          ? Object.fromEntries(
              Object.entries(value)
                .reverse()
                .map(([key, item]) => [key, reverse(item)])
            )
          : value;
    const tree = reverse(parsed.tree) as SourceSyntaxNode;
    tree.comments = {before: [], inline: [], after: []};
    expect(replace(parsed.baseline, tree).source).toBe(source);
  });
});

const allComments = (
  node: SourceSyntaxNode
): import('../src/source-syntax.js').SourceSyntaxComment[] => [
  ...Object.values(node.comments || {}).flat(),
  ...(node.kind === 'map'
    ? node.entries.flatMap((pair) => [
        ...Object.values(pair.comments || {}).flat(),
        ...allComments(pair.value)
      ])
    : node.kind === 'sequence'
      ? node.items.flatMap(allComments)
      : [])
];
it.each(['\n', '\r\n'])(
  'uses deterministic one-line comment nodes including blank and trailing empty comments (%j)',
  (eol) => {
    const source = ['# first', '#', '# third', 'value: "kept" # inline', '# tail', '#', ''].join(
      eol
    );
    const parsed = parseSourceSyntax(source);
    const comments = allComments(parsed.tree);
    expect(comments.map((c) => c.text)).toEqual([' tail', ' ', ' first', ' ', ' third', ' inline']);
    expect(comments.every((c) => !/[\r\n]/u.test(c.text))).toBe(true);
    expect(new Set(comments.map((c) => c.id)).size).toBe(comments.length);
    expect(parsed.tree).toEqual(parseSourceSyntax(source).tree);
    expect(replace(parsed.baseline, copy(parsed.tree)).source).toBe(source);
    const edited = copy(parsed.tree);
    allComments(edited).find((c) => c.text === ' third')!.text = ' changed third';
    const result = replace(parsed.baseline, edited);
    expect(result.source).toContain('# changed third');
    for (const text of ['# first', '# tail', '# inline']) expect(result.source).toContain(text);
    expect(
      allComments(parseSourceSyntax(result.source).tree).some((c) => c.text === ' changed third')
    ).toBe(true);
    if (eol === '\r\n') expect(result.source.replaceAll('\r\n', '')).not.toContain('\n');
  }
);
it('keeps genuinely blank comment-group lines explicit and refuses multiline field payloads', () => {
  const source = '# first\n\n# third\nvalue: 1\n';
  const parsed = parseSourceSyntax(source);
  expect(allComments(parsed.tree).map((c) => c.text)).toEqual([' first', '', ' third']);
  expect(replace(parsed.baseline, parsed.tree).source).toBe(source);
  const changed = copy(parsed.tree);
  allComments(changed)[0]!.text = ' first\n hidden second';
  expect(() => replace(parsed.baseline, changed)).toThrow(/Invalid comment/);
});

it('retains a bare # line on another scalar edit and emits new/edited empty comment nodes', () => {
  const parsed = parseSourceSyntax('#\nvalue: 1\n');
  const tree = copy(parsed.tree);
  if (tree.kind !== 'map' || tree.entries[0]!.value.kind !== 'scalar') throw Error();
  tree.entries[0]!.value.value = 2;
  const out = replace(parsed.baseline, tree);
  expect(out.source).toMatch(/^# *\n/u);
  expect(out.source).toContain('value: 2');
  const fresh = parseSourceSyntax('value: 1\n');
  const changed = copy(fresh.tree);
  changed.comments = {before: [{id: 'block:empty-comment', kind: 'comment', text: ''}]};
  expect(replace(fresh.baseline, changed).source).toMatch(/^# *\n/u);
  const editing = parseSourceSyntax('# nonempty\nvalue: 1\n');
  const empty = copy(editing.tree);
  allComments(empty)[0]!.text = '';
  expect(replace(editing.baseline, empty).source).toMatch(/^# *\n/u);
});
