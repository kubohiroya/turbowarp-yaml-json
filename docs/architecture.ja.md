# アーキテクチャ

[English](architecture.md)

## モデル

YAML/JSON データは immutable な scalar、pair、map、sequence、concat、empty フラグメントとして表現します。builder 操作は入力を変更せず、新しい値を返します。YAML または JSON 文字列は render ブロックでのみ生成します。

## 検証

JSON Schema 検証では、フラグメントを JavaScript の値へ変換して Ajv で validate します。reporter ブロックは `valid` または改行区切りのエラーを返し、boolean ブロックは Scratch の制御用に pass/fail だけを返します。

## 安全方針

string 値はレンダリング時に quote します。raw YAML/JSON を注入するブロックは v1 では提供しません。

## TurboWarp 境界

reporter block 間では `turbowarp-yaml-json:v1:` 接頭辞付きの値を渡します。value 引数に通常文字列が渡された場合は string scalar として扱います。
