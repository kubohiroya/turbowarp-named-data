export interface NamedDataFeatureFlags {
    readonly NAMED_DATA_REGISTRY_MVP: boolean;
    readonly NAMED_DATA_SCHEMA_REF?: boolean;
}
export declare const NAMED_DATA_REGISTRY_MVP_DEFAULT = false;
/** Startup-fixed rollout flags. Configure these before loading the bundle. */
export declare const FEATURE_FLAGS: Readonly<{
    NAMED_DATA_REGISTRY_MVP: boolean;
    NAMED_DATA_SCHEMA_REF: boolean;
}>;
