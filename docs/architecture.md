# Architecture

[日本語](architecture.ja.md)

## Model

YAML/JSON data is represented as immutable fragments:

```text
DataFragment
  -> scalar(string, number, boolean, null)
  -> pair(key, value)
  -> map(entries)
  -> sequence(items)
  -> concat(children)
  -> empty
```

Builder operations return new fragment values. Rendering is the only operation that produces final YAML or JSON text.

The parser converts only caller-provided text to the same `DataFragment` model. `auto` selects JSON when the complete input is valid JSON and otherwise selects YAML; callers may force either grammar. A successful parse therefore composes directly with rendering and JSON Schema validation.

## Validation

JSON Schema validation converts a fragment to a JavaScript value and validates it with Ajv. The reporter form returns `valid` or newline-separated validation errors. The boolean form returns only pass/fail for Scratch control flow.

## Safety Policy

String values are quoted when rendered. Parsing has no file or network capability. YAML uses the core safe schema, rejects parser warnings, rejects aliases before resolution, and never registers custom tags. Input bytes, nesting depth, and node count are bounded before a fragment is returned.

## TurboWarp Boundary

Reporter blocks serialize fragments with a `turbowarp-yaml-json:v1:` prefix. Plain strings passed into value arguments are treated as string scalar values.

## Build Outputs

```text
src/index.ts + src/extension.ts + src/yaml-json.ts
  -> vite-plugin-turbowarp-extension
  -> dist/turbowarp-yaml-json.js

src/config.ts + src/block-definitions.json
  -> extension-api-manifest Vite plugin
  -> dist/extension-manifest.json
```
