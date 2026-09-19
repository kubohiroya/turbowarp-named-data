export interface NamedDataFeatureFlags {
    readonly NAMED_DATA_REGISTRY_MVP: boolean;
}
export declare const NAMED_DATA_REGISTRY_MVP_DEFAULT = false;
/** Startup-fixed rollout flags. Configure these before loading the bundle. */
export declare const FEATURE_FLAGS: NamedDataFeatureFlags;
