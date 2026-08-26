# TurboWarp YAML/JSON

[日本語](README.ja.md)

A TurboWarp extension for building structured data with immutable reporter blocks, then rendering it as YAML or JSON at the output boundary.

## What it does

- creates string, number, boolean, and null scalar values;
- creates map pairs, maps, sequences, and composed fragments;
- renders the same built data as deterministic YAML or formatted JSON;
- validates built data with JSON Schema before it is served or exported;
- exports a block-free TypeScript composition API from `src/yaml-json.ts`.

## Requirements and safety

- Node.js 22 or newer;
- pnpm through Corepack;
- TurboWarp's unsandboxed extension option is not required.

Strings are quoted when rendered, and raw YAML/JSON injection blocks are intentionally not included. JSON Schema input is parsed as JSON and validation failures are returned as reporter text or boolean reporter values.

## Installation

```bash
corepack enable
pnpm install --frozen-lockfile
```

The package is version-pinned when used from npm:

```bash
pnpm add --save-exact @kubohiroya/turbowarp-yaml-json@0.1.0
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
