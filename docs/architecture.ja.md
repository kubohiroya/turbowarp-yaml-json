# アーキテクチャ

[English](architecture.md)

## モデル

YAML/JSON データは immutable な scalar、pair、map、sequence、concat、empty フラグメントとして表現します。builder 操作は入力を変更せず、新しい値を返します。YAML または JSON 文字列は render ブロックでのみ生成します。

parserは呼び出し側から渡された文字列だけを、同じ `DataFragment` モデルへ変換します。`auto` は入力全体が正しいJSONならJSON、それ以外ならYAMLを選び、呼び出し側はgrammarを明示することもできます。成功したparse結果はrenderとJSON Schema検証へ直接渡せます。

## 検証

JSON Schema 検証では、フラグメントを JavaScript の値へ変換して Ajv で validate します。reporter ブロックは `valid` または改行区切りのエラーを返し、boolean ブロックは Scratch の制御用に pass/fail だけを返します。

## 安全方針

string 値はレンダリング時に quote します。parserはfile／networkへアクセスしません。YAMLはcore safe schemaを使用し、parser warning、alias、custom tagを拒否します。fragmentを返す前に入力byte数、nesting depth、node数の上限を検査します。

## TurboWarp 境界

reporter block 間では `turbowarp-yaml-json:v1:` 接頭辞付きの値を渡します。value 引数に通常文字列が渡された場合は string scalar として扱います。
