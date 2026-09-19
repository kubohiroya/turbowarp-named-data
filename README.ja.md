# TurboWarp-Named-Data

[English](README.md)

unsandboxed TurboWarp機能拡張間で共有する、runtime-neutralなNamed Data契約とregistryです。

## できること

- `namespace + name + kind + scope`の参照をproviderへ解決します。
- payloadをregistryへ複製せず、metadataとbyte列／stream bodyを公開します。
- 固定の`Symbol.for`を使い、別々にbundleされた機能拡張から同じregistryを取得できます。
- target scopeとproject scopeを分離し、project停止時にsession resourceを解放します。
- 同じnamespaceとkindのprovider衝突や不正なserviceを安定した`NAMED_DATA_*` codeで拒否します。

## 要件と安全性

TurboWarpのunsandboxed extension modeが必要です。MVP feature flagは起動時固定かつ既定OFFです。bundleのload前にhostが明示的に設定します。

```js
globalThis.__TW_NAMED_DATA_FEATURE_FLAGS__ = {NAMED_DATA_REGISTRY_MVP: true};
```

registryが保持するのはprovider descriptor、metadata、release callbackだけです。bodyのbyte列やstreamをregistry、manifest、fixtureへ保存しません。

## インストール

```bash
pnpm add --save-exact @kubohiroya/turbowarp-named-data@0.1.0
```

feature flagの設定後に`dist/named-data.js`をTurboWarpへloadします。providerは`src/contract.ts`の契約に従い、`installNamedDataRegistry(runtime)`または`getNamedDataRegistry(runtime)`で共有serviceへ接続します。

他packageはside effectのないESM entrypointと型宣言を利用します。

```ts
import {
  installNamedDataRegistry,
  type NamedDataProvider,
  type NamedDataReference
} from '@kubohiroya/turbowarp-named-data/composition';
```

package exportは`dist/composition.js`へ解決され、型は`dist/types/composition.d.ts`から提供されます。このentrypointをimportしてもTurboWarp extensionは登録されません。

## ブロック

MVPが有効な場合だけ、registryの利用可否を確認するBoolean blockを表示します。provider登録とbody accessはScratch value blockではなく、機能拡張間APIです。

## 契約概要

- kind: `structured`、`document`、`binary`、`asset`
- scope: `target`、`project`
- representation: `json`、`yaml`、`html`、`markdown`、`raw`
- body: `Uint8Array`または`ReadableStream<Uint8Array>`
- revision: 解釈しないopaque string
- provider dispatch key: `(namespace, kind)`。同じ論理namespaceへ異なるkindを登録できます。
- 共有symbol: `@kubohiroya/turbowarp-named-data/registry`

[アーキテクチャ](docs/architecture.ja.md)、[参照schema](schemas/named-data-reference.schema.json)、[extension manifest schema](schemas/extension-manifest.schema.json)も参照してください。

## 開発

```bash
pnpm install --frozen-lockfile
pnpm run check
```

生成artifactには`dist/named-data.js`、`dist/composition.js`、`dist/types/`、`dist/extension-manifest.json`を含みます。

## ライセンス

SPDX-License-Identifier: MPL-2.0
