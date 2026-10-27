# TurboWarp YAML/JSON

<img src="assets/block-icon.svg" alt="" width="48" height="48">

[English](README.md) | 日本語

TurboWarp 上で YAML／JSON 文字列を安全に parse するか、構造化データを immutable な reporter 値として組み立て、最後の出力境界で YAML または JSON 文字列へ render する拡張です。

## 実行できるサンプル

[**TurboWarp Editorでデモを開く**](https://turbowarp.org/editor?project_url=https%3A%2F%2Fkubohiroya.github.io%2Fturbowarp-yaml-json%2Fsamples%2Fyaml-json-roundtrip.sb3) · [SB3をダウンロード](https://kubohiroya.github.io/turbowarp-yaml-json/samples/yaml-json-roundtrip.sb3)

**Allow**で読み込みを許可し、緑の旗を押します。
`parseText`で小さなYAMLを読み、`renderJson`・`renderYaml`の結果と解析成功を表示。サンプルの元データと期待結果は[`samples/README.md`](samples/README.md)に記載しています。

`pnpm run samples:build`でSB3を再生成し、`pnpm run samples:check`で更新漏れと生成処理を確認します。

## 概要

- string、number、boolean、null の scalar 値を作れます。
- pair、map、sequence、concat で object/array 相当のデータを組み立てられます。
- 呼び出し側から渡された YAML／JSON 文字列を、同じ fragment 表現へ安全に parse できます。
- 同じデータを YAML または整形済み JSON として出力できます。
- JSON Schema で、配信または出力前のデータを validate できます。
- ブロックなしで使える TypeScript composition API も `src/yaml-json.ts` から提供します。

## HTTP Server 連携

`turbowarp-http-server` とは npm パッケージ依存では結合しません。YAML/JSON 拡張で作ったフラグメントを `render YAML` または `render JSON` で文字列化し、HTTP レスポンス本文として渡してください。content type は `application/yaml; charset=utf-8` または `application/json; charset=utf-8` を明示する想定です。

## JSON Schema 検証

JSON Schema は JSON 文字列として渡します。`validate JSON Schema ...` は `valid` またはエラー詳細を返し、`JSON Schema ... accepts data ...?` は boolean reporter として使えます。

## YAML／JSON文字列のparse

`parse [TEXT] as [FORMAT]` へ文字列と `auto`、`YAML`、`JSON` のいずれかを渡します。成功時のreporter値は、そのまま既存の `render JSON`、`render YAML`、JSON Schema blockへ渡せます。失敗時は空文字列を返し、`last parse succeeded?`、`last parse diagnostic`、`last parse error line`、`last parse error column` から状態と診断を取得できます。line／columnは1始まりで、取得できない場合は0です。

parse対象はblockへ直接渡された文字列だけです。この拡張はfileやnetworkへアクセスしません。YAML aliasと未知のtagを拒否し、入力は最大256 KiB、nestingは最大64、node数は最大50,000に制限します。したがって、file pickerやTurboWarp project assetから文字列を取得する処理はconsumer側で実装してください。

追加されたparse blockは既存builder blockを変更しない追加APIです。問題がある場合はparse blockを使わず、従来どおりfragment構築blockでJSON相当の値を作る運用へ戻せます。

## 統合ビルド用module API

このソースのbuildは、単体JSとは別に、統合用のESM入口`./bundle-module`と
型宣言を`lib-module/`へ生成します。

```ts
import {bundleModuleMetadata, createExtension, type ScratchApi}
  from '@kubohiroya/turbowarp-yaml-json/bundle-module';

export function createMember(memberScratch: ScratchApi) {
  return createExtension(memberScratch);
}
```

import時はglobal Scratch / window / documentを参照せず、拡張の生成・登録を行いません。
明示的なcreateExtension(memberScratch)ごとに新しいinstanceを返し、後から実行する
ブロック・編集用補助処理・lifecycle callbackも同じhostを使います。factoryは
Scratch.extensions.registerを呼びません。単体entryも同じfactoryを使い、登録は1回です。

凍結されたbundleModuleMetadataはformatVersion: 1、元のid、unsandboxed条件を
宣言します。統合hostが生成前に検査し、登録とdisposeを管理します。ID・opcode・
保存データ形式を変更しません。

フラグメント形式・解析制限・診断・利用者指定JSON Schemaの実行時検証を維持します。Ajvは引き続きruntime依存です。従来どおりgetInfo()で利用可能な固定入力metadataを1回登録し、dispose()はこのinstanceの登録とlistenerを解除します。YamlJsonExtensionを直接newする内部コードでもhostを明示的に渡します。

yaml等のruntime依存とそのsubpathは外部importのまま保持します。既存の小さな編集用
純粋ヘルパーだけを含め、production consumerには編集packageやGUIエンジンを要求しません。
公開型は既存tsconfigと同じES2022の型ライブラリを使い、生成JSはES2020を対象とします。
既存exportsを維持して./bundle-moduleを追加し、templateへのruntime依存は追加しません。

pnpm run build:moduleで生成し、pnpm run check:moduleは実tarballをproduction依存だけの
consumerへinstallしてhost分離・単体版との動作一致・公開型・編集エンジンの非混入を検査します。
sb3-toolchain側の統合buildは[sb3-toolchain #65](https://github.com/kubohiroya/sb3-toolchain/issues/65)の後続です。
切戻しはこのmodule入口を選択せず従来のclassic distを読み込みます。新しいruntimeフラグや
保存データの移行は導入しません。

## 開発

```bash
npm install --global corepack@latest
corepack enable
pnpm install --frozen-lockfile
pnpm run check
```

## ライセンス

SPDX-License-Identifier: MPL-2.0

固定入力の編集範囲・互換性・切戻しについては [固定入力の編集](docs/fixed-input-editors.ja.md) を参照してください。
