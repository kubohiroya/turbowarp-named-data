import definitions from './block-definitions.json';
import {extensionConfig} from './config.js';
import type {NamedDataRegistryService} from './contract.js';
import {FEATURE_FLAGS, type NamedDataFeatureFlags} from './feature-flags.js';
import {bindNamedDataRegistryLifecycle, installNamedDataRegistry} from './registry.js';

export class NamedDataExtension implements TurboWarpExtension {
  private readonly registry?: NamedDataRegistryService;
  private readonly unbindLifecycle?: () => void;

  public constructor(
    runtime: ScratchRuntime,
    featureFlags: NamedDataFeatureFlags = FEATURE_FLAGS
  ) {
    if (featureFlags.NAMED_DATA_REGISTRY_MVP) {
      this.registry = installNamedDataRegistry(runtime);
      this.unbindLifecycle = bindNamedDataRegistryLifecycle(runtime, this.registry);
    }
  }

  public getInfo(): Record<string, unknown> {
    return {
      id: extensionConfig.id,
      name: Scratch.translate(definitions.extensionName),
      docsURI: extensionConfig.docsURI,
      blockIconURI: extensionConfig.blockIconURI,
      blocks: this.registry
        ? [
            {
              opcode: 'isRegistryAvailable',
              blockType: Scratch.BlockType.BOOLEAN,
              text: Scratch.translate('named data registry available?')
            }
          ]
        : []
    };
  }

  public isRegistryAvailable(): boolean {
    return this.registry !== undefined;
  }

  /** Used by hosts that unload extensions without stopping the project. */
  public dispose(): void {
    this.unbindLifecycle?.();
  }
}
