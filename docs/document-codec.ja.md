# 文書原文と JSON 値の共通変換

`@kubohiroya/turbowarp-yaml-json/codec` は VM や GUI を作らないコンパイル済み入口です。

```js
import {parseValue, fromValue, serializeValue, PARSE_LIMITS} from '@kubohiroya/turbowarp-yaml-json/codec';
const result = parseValue('# 注釈\na: 1\n', 'yaml');
if (!result.success) console.error(result.diagnostic);
```

`parseValue` は既存の `parseData` と同じパーサーと診断を使い、fragment の代わりに JSON 値を返します。形式は `auto`・`json`・`yaml` です。入力は 256 KiB、深さ 64、ノード数 50,000、YAML alias は 0 に制限します。既存の fragment・ブロック・出力 API は維持します。JSON 値 API は標準 JSON の own property（`__proto__` 等も含む）を欠落させない profile を選び、既存 fragment API の既定出力とは分離します。組込 `JSON.parse` の値を同じ fragment / budget 検査経路へ渡し、独自の JSON parser は追加しません。

`fromValue(value)` は有限数・配列・通常の JSON オブジェクトだけを fragment へ変換します。循環、疎配列、アクセサー、独自クラスは拒否します。通常はパースと同じ値の深さ・ノード数制限を使います。`{enforceLimits:false}` は、パース後に拡張された既存の値を出力する互換処理用です。

```js
const text = serializeValue(result.value, {
  format: 'json', keyOrder: 'unicode', indent: 0, trailingNewline: false
});
```

`serializeValue` は形式とキー順を必ず指定します。`keyOrder` は `preserve` または Unicode code point 順の `unicode` です。JSON の字下げは 0–10（既定 2）、末尾改行は JSON で既定あり、YAML で既定なしです。`enforceValueLimits:false` は従来の structured runtime の拡張済み値を保持する場合に限り使用します。

この API はコメント・改行・引用符・空白を復元しません。文書の原文を正本として保持し、値への変換を理由に原文を再生成して保存しないでください。書式を正規化した別の出力が必要な場合だけ `serializeValue` を明示的に呼びます。

## JSON Schema の明示プロファイル

```js
import {validateValueWithJsonSchema} from '@kubohiroya/turbowarp-yaml-json/schema';
const checked = validateValueWithJsonSchema(schemaObject, jsonValue, {dialect: '2020-12'});
```

返却値は同期の `{valid, errors}` です。既定は `draft-07`、2020-12 は明示指定し Ajv2020 を使用します。ネットワークで未登録 `$ref` を取得しません。既存の `validateWithJsonSchema(schemaJson, fragment)` の意味は変更しません。

この full JSON Schema プロファイルは structured-data の既存 `structured-subset` プロファイルとは異なります。後者が無視するキーワードを full JSON Schema に渡すと制約として解釈される場合があるため、同じ検証器として暗黙に置き換えないでください。

## 検証と切戻し

`build:codec` で JS と型を生成します。codec の利用だけでは structured runtime に Schema コンパイラーを混入させません。従来の公開入口・classic extension を利用し、新しいサブパスの選択を取り消すことで切戻せます。保存データの変換はありません。

## 原文・コメントを持つ構文木

`@kubohiroya/turbowarp-yaml-json/source-syntax` の `parseSourceSyntax(source, {format})` は `{baseline, format, tree}` を返します。`tree` は map / pair / sequence / scalar と独立した comment node の JSON 形式です。各ノードには ID があり、before / inline / after のコメントを扱えます。`baseline` は同じ process 内だけで使う opaque な権限で、原文のコピーを保存データへ埋め込むものではありません。

`applySourceSyntaxEdits(baseline, [{op:'replace-tree', tree}])` は安全検証した編集後の `{source, format, tree}` を返します。変更がなければ引用符・空白・改行も含め元の文字列をそのまま返します。編集時は YAML の Document / CST を使い、コメントと node ID を明示的に扱います。native JSON は JSON のまま出力します。alias、重複キー、偽の baseline、不正・重複 ID は拒否します。

値だけへのパースでコメントを失わせず、原文・汎用 YAML ブロック・所有者のスキーマ専用ブロックを接続する際の共通基盤です。所有者は変換後の意味の等価性と Schema / 実行条件を検証し、コメントや未対応構文を黙って削除する変換は拒否してください。
