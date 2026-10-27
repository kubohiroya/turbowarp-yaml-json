# Yaml Jsonの最小デモ

- 配布: [`yaml-json-roundtrip.sb3`](https://kubohiroya.github.io/turbowarp-yaml-json/samples/yaml-json-roundtrip.sb3)
- 起動: [TurboWarp Editor](https://turbowarp.org/editor?project_url=https%3A%2F%2Fkubohiroya.github.io%2Fturbowarp-yaml-json%2Fsamples%2Fyaml-json-roundtrip.sb3)
- 操作: **Allow**で読み込みを許可し、緑の旗を押します。
- 内容: `parseText`で小さなYAMLを読み、`renderJson`・`renderYaml`の結果と解析成功を表示
- 期待結果: 解析結果がtrueになり、JSONとYAMLの両方にname: TurboWarpとscore: 7が含まれます。

`manifest.json`に拡張ID・JSパス・sandbox条件・期待結果を記録しています。
`yaml-json-roundtrip/project.json`と自作SVGを編集し、次のコマンドで再生成します。

```bash
pnpm run samples:build
pnpm run samples:check
pnpm run pages:build
```

Node.jsは`.nvmrc`指定版を使います。サンプル生成に追加依存はありません。
生成したSB3もコミットし、`_site/`のdocs・dist・SB3をPagesへ公開します。
unsandboxed拡張は検証対象JSをSB3へ同梱し、利用者が通常の同意画面で許可します。
sandbox互換の拡張はPages上のJSを参照します。

緑の旗で毎回入力から結果を生成します。停止してから再実行できます。

切戻しはサンプル・READMEリンク・Pages配信設定の追加をrevertします。
