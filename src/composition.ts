/**
 * Canonical package entrypoint for extension-to-extension composition.
 * This module is side-effect free and does not register a TurboWarp extension.
 */
export {
  NAMED_DATA_CONTRACT_VERSION,
  NAMED_DATA_ERROR_CODES,
  NAMED_DATA_KINDS,
  NAMED_DATA_REGISTRY_SYMBOL,
  NAMED_DATA_REGISTRY_SYMBOL_KEY,
  NAMED_DATA_REPRESENTATIONS,
  NAMED_DATA_SCOPES,
  NamedDataError,
  type NamedDataBody,
  type NamedDataErrorCode,
  type NamedDataKind,
  type NamedDataMetadata,
  type NamedDataProvider,
  type NamedDataProviderRegistration,
  type NamedDataReference,
  type NamedDataRegistryService,
  type NamedDataReleaseReason,
  type NamedDataRepresentation,
  type NamedDataResolveContext,
  type NamedDataScope
} from './contract.js';

export {
  bindNamedDataRegistryLifecycle,
  getNamedDataRegistry,
  installNamedDataRegistry,
  NamedDataRegistry
} from './registry.js';

export {
  FEATURE_FLAGS,
  NAMED_DATA_REGISTRY_MVP_DEFAULT,
  type NamedDataFeatureFlags
} from './feature-flags.js';
