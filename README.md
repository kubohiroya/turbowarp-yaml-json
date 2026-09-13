# TurboWarp YAML/JSON

[日本語](README.ja.md)

A TurboWarp extension for safely parsing YAML/JSON text or building structured data with immutable reporter blocks, then rendering it at the output boundary.

## What it does

- creates string, number, boolean, and null scalar values;
- creates map pairs, maps, sequences, and composed fragments;
- safely parses caller-provided YAML or JSON text into the same fragment representation;
- renders the same built data as deterministic YAML or formatted JSON;
- validates built data with JSON Schema before it is served or exported;
- exports a block-free TypeScript composition API from `src/yaml-json.ts`.

## Requirements and safety

- Node.js 22 or newer;
- pnpm through Corepack;
- TurboWarp's unsandboxed extension option is not required.

Strings are quoted when rendered. Parsing is limited to the string passed directly to the block; it never reads files or accesses the network. YAML aliases and unknown tags are rejected, and parsing enforces a 256 KiB input limit, a nesting-depth limit of 64, and a node-count limit of 50,000. JSON Schema input is parsed as JSON and validation failures are returned as reporter text or boolean reporter values.

## Installation

```bash
corepack enable
pnpm install --frozen-lockfile
```

The package is version-pinned when used from npm:

```bash
pnpm add --save-exact @kubohiroya/turbowarp-yaml-json@0.2.0
```

## Quick Start

```ts
import {
  concat,
  map,
  numberValue,
  pair,
  renderJson,
  renderYaml,
  sequence,
  stringValue,
  validateWithJsonSchema
} from '@kubohiroya/turbowarp-yaml-json';

const document = map(
  concat(
    pair('name', stringValue('sensor')),
    pair('readings', sequence(concat(numberValue(21), numberValue(22))))
  )
);

const yamlBody = renderYaml(document);
const jsonBody = renderJson(document);
const validation = validateWithJsonSchema(
  '{"type":"object","required":["name","readings"]}',
  document
);
```

To parse external text, use `parse [TEXT] as [FORMAT]` with `auto`, `YAML`, or `JSON`. A successful reporter value can be passed directly to `render JSON`, `render YAML`, and the JSON Schema blocks. On failure it returns an empty string; inspect `last parse succeeded?`, `last parse diagnostic`, `last parse error line`, and `last parse error column`. Line and column values are one-based, or zero when unavailable.

For `turbowarp-http-server`, pass the rendered string as the response body and select `Content-Type: application/yaml; charset=utf-8` or `Content-Type: application/json; charset=utf-8`. The HTTP server does not need a package dependency on this extension.

## Block reference

<!-- BEGIN GENERATED BLOCKS -->

### `string [VALUE]`

Creates a string value.

| Property | Value |
|---|---|
| Type | Reporter |
| Opcode | `string` |
| `VALUE` | String, default: `sensor` |

### `number [VALUE]`

Creates a finite number value.

| Property | Value |
|---|---|
| Type | Reporter |
| Opcode | `number` |
| `VALUE` | Number, default: `21` |

### `boolean [VALUE]`

Creates a boolean value.

| Property | Value |
|---|---|
| Type | Reporter |
| Opcode | `boolean` |
| `VALUE` | Boolean, default: `true` |

### `null`

Creates a null value.

| Property | Value |
|---|---|
| Type | Reporter |
| Opcode | `nullValue` |

### `pair key [KEY] value [VALUE]`

Creates a map key/value pair.

| Property | Value |
|---|---|
| Type | Reporter |
| Opcode | `pair` |
| `KEY` | String, default: `temperature` |
| `VALUE` | String, default: `21` |

### `map [ENTRIES]`

Creates an object/map from pair fragments.

| Property | Value |
|---|---|
| Type | Reporter |
| Opcode | `map` |
| `ENTRIES` | String, default: `` |

### `sequence [ITEMS]`

Creates an array/sequence from item fragments.

| Property | Value |
|---|---|
| Type | Reporter |
| Opcode | `sequence` |
| `ITEMS` | String, default: `` |

### `[LEFT] followed by [RIGHT]`

Combines fragments without mutating either input.

| Property | Value |
|---|---|
| Type | Reporter |
| Opcode | `concat` |
| `LEFT` | String, default: `` |
| `RIGHT` | String, default: `` |

### `render YAML [FRAGMENT]`

Renders a fragment to YAML text.

| Property | Value |
|---|---|
| Type | Reporter |
| Opcode | `renderYaml` |
| `FRAGMENT` | String, default: `` |

### `render JSON [FRAGMENT]`

Renders a fragment to formatted JSON text.

| Property | Value |
|---|---|
| Type | Reporter |
| Opcode | `renderJson` |
| `FRAGMENT` | String, default: `` |

### `validate JSON Schema [SCHEMA] data [FRAGMENT]`

Returns JSON Schema validation details for the built data.

| Property | Value |
|---|---|
| Type | Reporter |
| Opcode | `validateSchema` |
| `SCHEMA` | String, default: `{"type":"object","required":["temperature"]}` |
| `FRAGMENT` | String, default: `` |

### `JSON Schema [SCHEMA] accepts data [FRAGMENT]?`

Reports whether the built data passes JSON Schema validation.

| Property | Value |
|---|---|
| Type | Boolean |
| Opcode | `isValidSchema` |
| `SCHEMA` | String, default: `{"type":"object","required":["temperature"]}` |
| `FRAGMENT` | String, default: `` |

### `parse [TEXT] as [FORMAT]`

Safely parses the provided YAML or JSON text into a fragment.

| Property | Value |
|---|---|
| Type | Reporter |
| Opcode | `parseText` |
| `TEXT` | String, default: `name: sensor` |
| `FORMAT` | String, default: `auto` |

### `last parse succeeded?`

Reports whether the most recent parse operation succeeded.

| Property | Value |
|---|---|
| Type | Boolean |
| Opcode | `lastParseSucceeded` |

### `last parse format`

Reports the format selected by the most recent parse operation.

| Property | Value |
|---|---|
| Type | Reporter |
| Opcode | `lastParseFormat` |

### `last parse diagnostic`

Reports the code, location, and message for the most recent parse failure.

| Property | Value |
|---|---|
| Type | Reporter |
| Opcode | `lastParseDiagnostic` |

### `last parse error line`

Reports the one-based line of the most recent parse failure, or zero when unavailable.

| Property | Value |
|---|---|
| Type | Reporter |
| Opcode | `lastParseLine` |

### `last parse error column`

Reports the one-based column of the most recent parse failure, or zero when unavailable.

| Property | Value |
|---|---|
| Type | Reporter |
| Opcode | `lastParseColumn` |

<!-- END GENERATED BLOCKS -->

## Important behavior

Scratch reporter blocks exchange opaque `turbowarp-yaml-json:v1:` values while builder blocks are chained. Ordinary strings passed into value positions become string values. Final output is produced only by `render YAML [FRAGMENT]` or `render JSON [FRAGMENT]`.

Top-level `concat` merges object/map fragments when all children are maps or pairs. Other top-level combinations render as a sequence-like list of values for JSON value conversion.

## Development

```bash
pnpm run check
```

The check runs type checking, linting, tests, generated README validation, `dist/` reproducibility, repository policy validation, and an npm package dry run.

## Release

Keep `package.json` as the version source of truth. Before publishing, run:

```bash
pnpm run check
npm pack --dry-run --ignore-scripts
```

Release artifacts include `dist/turbowarp-yaml-json.js`, `dist/extension-manifest.json`, `README.md`, `README.ja.md`, and `LICENSE`.

## License

SPDX-License-Identifier: MPL-2.0
