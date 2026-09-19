# Architecture

[日本語](architecture.ja.md)

## Runtime contract

The registry is stored on the TurboWarp runtime with `Symbol.for('@kubohiroya/turbowarp-named-data/registry')`. Separately bundled extensions retrieve the same object. An invalid object in this stable slot is rejected and never overwritten. The contract has no generation number; breaking changes update providers and consumers together.

Providers own all payload and storage state. The registry owns only `(namespace, kind)` registrations and release callbacks for currently open bodies. A namespace is a logical ownership domain while kind is the data type, so providers of different kinds may share one namespace. `openBody` returns bytes or a stream directly to the consumer. Metadata keeps `nativeRepresentation` (the stored type) separate from `representation` (the selected output), and the registry validates both against the data kind. A reference or metadata document must never contain inline bytes, base64, or a data URL.

## Package entrypoints

`dist/named-data.js` is the TurboWarp IIFE and performs extension registration. `@kubohiroya/turbowarp-named-data/composition` is a separate, side-effect-free ESM entrypoint for providers and consumers. It exports the canonical contract, registry functions, and feature-flag declarations from `dist/composition.js`; TypeScript resolves its declarations from `dist/types/composition.d.ts`.

## Resolution

```text
reference + representation + target/project context
  -> (namespace, kind) provider
  -> canResolve
  -> stat or openBody
  -> metadata + borrowed body
  -> release
```

Target-scoped references require a target identity; project-scoped references require a project identity. The two contexts are not substituted for each other. Revisions are opaque strings.

## Lifetime

Registrations are session-scoped unless explicitly persistent. `PROJECT_STOP_ALL` releases every open handle, unregisters and releases session providers, and asks persistent providers to clear project-session state. Release operations are idempotent.

## Rollout and rollback

`NAMED_DATA_REGISTRY_MVP` is read once at bundle startup and defaults to false. With the flag off, the extension does not publish a registry service or blocks. Rollback therefore consists of restoring the default/off flag; private registries in consuming extensions remain usable.

## Manifest and schemas

Extension manifest format 2 declares the runtime service ID, stable symbol key, feature flag, and default state. `schemas/named-data-reference.schema.json` is the wire-safe descriptor schema; runtime-only target/project identities and payload are intentionally absent.
