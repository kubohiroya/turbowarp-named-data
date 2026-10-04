# TurboWarp-Named-Data

[日本語](README.ja.md)

A shared, runtime-neutral named-data contract and registry for unsandboxed TurboWarp extensions.

## What it does

- resolves `namespace + name + kind + scope` references through registered providers;
- carries optional versioned `schemaRef` identities on structured references and metadata;
- exposes metadata and byte/stream bodies without copying payloads into the registry;
- shares one registry between separately bundled extensions through a stable `Symbol.for` key;
- separates target and project scope and cleans session resources on project stop;
- rejects duplicate namespace-kind providers and invalid services with stable `NAMED_DATA_*` codes.

## Requirements and safety

The extension requires TurboWarp's unsandboxed extension mode. The MVP is startup-fixed and disabled by default. A host must configure the flag before loading the bundle:

```js
globalThis.__TW_NAMED_DATA_FEATURE_FLAGS__ = {NAMED_DATA_REGISTRY_MVP: true};
```

Only provider descriptors, metadata, and release callbacks are retained by the registry. Body bytes and streams are returned directly and are never placed in the manifest, fixtures, or registry state.

Structured references may include `schemaRef: { id, version }`. IDs use lowercase stable names such as `com.example.profile`; versions are complete Semantic Version strings. Providers must return the same identity in metadata. A mismatch fails with `NAMED_DATA_SCHEMA_VERSION_MISMATCH`; schema documents and JSON values remain the provider/consumer's responsibility. The `NAMED_DATA_SCHEMA_REF` startup flag is opt-in and defaults to `false`. Consumers that cannot resolve an identity should report `NAMED_DATA_SCHEMA_NOT_FOUND` or `NAMED_DATA_SCHEMA_UNRESOLVED`; they must not guess a version.

## Installation

```bash
pnpm add --save-exact @kubohiroya/turbowarp-named-data@0.3.0
```

Load `dist/named-data.js` in TurboWarp after setting the feature flag. Providers use the contract in `src/contract.ts` and install or retrieve the shared service with `installNamedDataRegistry(runtime)` or `getNamedDataRegistry(runtime)`.

Other packages consume the side-effect-free ESM entrypoint and its declarations:

```ts
import {
  installNamedDataRegistry,
  type NamedDataProvider,
  type NamedDataReference
} from '@kubohiroya/turbowarp-named-data/composition';
```

The package export resolves to `dist/composition.js` with types from `dist/types/composition.d.ts`. Importing it does not register the TurboWarp extension.

## Block reference

<!-- BEGIN GENERATED BLOCKS -->

### `named data registry available?`

Reports whether the startup-fixed Named Data registry feature is enabled.

| Property | Value |
|---|---|
| Type | Boolean |
| Opcode | `isRegistryAvailable` |

<!-- END GENERATED BLOCKS -->

The availability block is shown only while the MVP flag is enabled. Provider registration and body access are extension-to-extension APIs rather than Scratch value blocks.

## Contract summary

- kinds: `structured`, `document`, `binary`, `asset`;
- scopes: `target`, `project`;
- optional structured schema identity: stable schema ID plus complete SemVer version, with no schema body;
- representations: `json`, `yaml`, `html`, `markdown`, `raw`;
- body: `Uint8Array` or `ReadableStream<Uint8Array>`;
- revision: opaque string;
- provider dispatch key: `(namespace, kind)`; different kinds may share one logical namespace.
- shared symbol: `@kubohiroya/turbowarp-named-data/registry`.

See [Architecture](docs/architecture.md), the [reference schema](schemas/named-data-reference.schema.json), and the [extension manifest schema](schemas/extension-manifest.schema.json).

## Development

```bash
pnpm install --frozen-lockfile
pnpm run check
```

Generated release artifacts include `dist/named-data.js`, `dist/composition.js`, `dist/types/`, and `dist/extension-manifest.json`.

## License

SPDX-License-Identifier: MPL-2.0
