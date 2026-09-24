import {
  createExtensionManifest,
  serializeExtensionManifest
} from '@kubohiroya/turbowarp-extension-manifest';
import {describe, expect, it} from 'vitest';
import definitions from '../src/block-definitions.json';
import {extensionConfig} from '../src/config.js';
import {createRuntimeServices, serializeRuntimeServices} from '../src/runtime-services.js';

describe('extension API manifest', () => {
  it('serializes the canonical block definitions deterministically', () => {
    const first = serializeExtensionManifest(extensionConfig.id, definitions);
    const second = serializeExtensionManifest(extensionConfig.id, structuredClone(definitions));
    const manifest = createExtensionManifest(extensionConfig.id, definitions);

    expect(first).toBe(second);
    expect(first).toBe(`${JSON.stringify(manifest, null, 2)}\n`);
    expect(manifest.formatVersion).toBe(1);
    expect(manifest.blocks).toHaveLength(definitions.blocks.length);
  });

  // The manifest describes the block API. Runtime services are a different axis and used to collide
  // with an unrelated format version 2 defined by two other extensions.
  it('keeps runtime services out of the manifest', () => {
    expect(createExtensionManifest(extensionConfig.id, definitions)).not.toHaveProperty(
      'runtimeServices'
    );
  });
});

describe('runtime services artifact', () => {
  it('describes the disabled-by-default registry service', () => {
    const artifact = createRuntimeServices(definitions);

    expect(artifact.formatVersion).toBe(1);
    expect(artifact.runtimeServices).toEqual([
      {
        id: 'named-data-registry',
        symbolKey: '@kubohiroya/turbowarp-named-data/registry',
        featureFlag: 'NAMED_DATA_REGISTRY_MVP',
        defaultEnabled: false
      }
    ]);
  });

  it('serializes deterministically', () => {
    expect(serializeRuntimeServices(definitions)).toBe(
      serializeRuntimeServices(structuredClone(definitions))
    );
  });

  it('rejects a service without a boolean default', () => {
    expect(() =>
      createRuntimeServices({runtimeServices: [{id: 'x', symbolKey: 'y', featureFlag: 'Z'}]})
    ).toThrow('defaultEnabled must be a boolean');
  });

  it('rejects duplicate service IDs', () => {
    const service = {id: 'dup', symbolKey: 'y', featureFlag: 'Z', defaultEnabled: false};
    expect(() => createRuntimeServices({runtimeServices: [service, service]})).toThrow(
      'Duplicate runtime service ID: dup'
    );
  });
});
