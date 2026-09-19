export interface NamedDataFeatureFlags {
  readonly NAMED_DATA_REGISTRY_MVP: boolean;
}

export const NAMED_DATA_REGISTRY_MVP_DEFAULT = false;

function configuredFlag(name: keyof NamedDataFeatureFlags): boolean {
  const configured = globalThis as typeof globalThis & {
    __TW_NAMED_DATA_FEATURE_FLAGS__?: Partial<Record<keyof NamedDataFeatureFlags, unknown>>;
  };
  const value = configured.__TW_NAMED_DATA_FEATURE_FLAGS__?.[name];
  return value === true || value === 'true';
}

/** Startup-fixed rollout flags. Configure these before loading the bundle. */
export const FEATURE_FLAGS: NamedDataFeatureFlags = Object.freeze({
  NAMED_DATA_REGISTRY_MVP: configuredFlag('NAMED_DATA_REGISTRY_MVP')
});
