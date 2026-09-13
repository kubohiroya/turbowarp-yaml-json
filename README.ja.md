# TurboWarp YAML/JSON

[English](README.md)

TurboWarp 上で YAML／JSON 文字列を安全に parse するか、構造化データを immutable な reporter 値として組み立て、最後の出力境界で YAML または JSON 文字列へ render する拡張です。

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

## 開発

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm run check
```

## ライセンス

SPDX-License-Identifier: MPL-2.0
