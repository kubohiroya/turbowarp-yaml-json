# TurboWarp YAML/JSON

[English](README.md)

TurboWarp 上で構造化データを immutable な reporter 値として組み立て、最後の出力境界で YAML または JSON 文字列へレンダリングする拡張です。

## 概要

- string、number、boolean、null の scalar 値を作れます。
- pair、map、sequence、concat で object/array 相当のデータを組み立てられます。
- 同じデータを YAML または整形済み JSON として出力できます。
- JSON Schema で、配信または出力前のデータを validate できます。
- ブロックなしで使える TypeScript composition API も `src/yaml-json.ts` から提供します。

## HTTP Server 連携

`turbowarp-http-server` とは npm パッケージ依存では結合しません。YAML/JSON 拡張で作ったフラグメントを `render YAML` または `render JSON` で文字列化し、HTTP レスポンス本文として渡してください。content type は `application/yaml; charset=utf-8` または `application/json; charset=utf-8` を明示する想定です。

## JSON Schema 検証

JSON Schema は JSON 文字列として渡します。`validate JSON Schema ...` は `valid` またはエラー詳細を返し、`JSON Schema ... accepts data ...?` は boolean reporter として使えます。

## 開発

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm run check
```

## ライセンス

SPDX-License-Identifier: MPL-2.0
