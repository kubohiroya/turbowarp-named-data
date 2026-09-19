# アーキテクチャ

[English](architecture.md)

## Runtime契約

registryは`Symbol.for('@kubohiroya/turbowarp-named-data/registry')`を使ってTurboWarp runtimeへ格納します。別bundleを再loadしても同じobjectを取得します。この固定slotに不正なobjectがある場合は上書きせず拒否します。契約の世代管理は行わず、破壊的変更ではproviderとconsumerを同時に更新します。

payloadとstorage stateはproviderが所有します。registryが保持するのは`(namespace, kind)`登録と、open中bodyのrelease callbackだけです。namespaceは論理的な所有領域、kindはデータ型であり、同じnamespaceへ異なるkindのproviderを登録できます。`openBody`はbyte列またはstreamをconsumerへ直接返します。metadataの`nativeRepresentation`は保存時の型、`representation`は今回選択した出力表現を示し、registryはkindとの整合を検証します。参照やmetadataへinline bytes、base64、data URLを含めてはいけません。

## Package entrypoint

`dist/named-data.js`はextension登録を行うTurboWarp IIFEです。`@kubohiroya/turbowarp-named-data/composition`はproviderとconsumer向けの、独立したside effectのないESM entrypointです。`dist/composition.js`からcanonical contract、registry関数、feature flag宣言をexportし、TypeScriptは`dist/types/composition.d.ts`から型を解決します。

## 解決処理

```text
reference + representation + target/project context
  -> (namespace, kind) provider
  -> canResolve
  -> stat または openBody
  -> metadata + borrowed body
  -> release
```

target scopeにはtarget identity、project scopeにはproject identityが必要です。両contextを相互に代用しません。revisionはopaque stringです。

## Lifetime

登録は明示的にpersistentとしない限りsession scopeです。`PROJECT_STOP_ALL`ではopen handleをすべて解放し、session providerを登録解除・解放し、persistent providerへproject session stateのclearを依頼します。releaseは冪等です。

## 段階導入とロールバック

`NAMED_DATA_REGISTRY_MVP`はbundle起動時に一度読み取り、既定値はfalseです。flag OFFではregistry serviceもblockも公開しません。したがってflagを既定OFFへ戻すだけでrollbackでき、consumer側のprivate registryは維持できます。

## Manifestとschema

Extension manifest format 2はruntime service ID、固定symbol key、feature flag、既定状態を宣言します。`schemas/named-data-reference.schema.json`はwire-safeなdescriptor schemaです。runtime固有のtarget/project identityとpayloadは意図的に含みません。
