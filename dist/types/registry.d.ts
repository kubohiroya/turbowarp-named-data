import { type NamedDataBody, type NamedDataMetadata, type NamedDataProvider, type NamedDataProviderRegistration, type NamedDataReference, type NamedDataRegistryService, type NamedDataRepresentation, type NamedDataResolveContext } from './contract.js';
export declare class NamedDataRegistry implements NamedDataRegistryService {
    private readonly providers;
    /** Only release callbacks are retained here; body payloads are never retained. */
    private readonly handles;
    registerProvider(provider: NamedDataProvider, options?: {
        readonly lifetime?: 'session' | 'persistent';
    }): NamedDataProviderRegistration;
    canResolve(reference: NamedDataReference, representation: NamedDataRepresentation): boolean;
    stat(reference: NamedDataReference, representation: NamedDataRepresentation, context?: NamedDataResolveContext): Promise<NamedDataMetadata>;
    openBody(reference: NamedDataReference, representation: NamedDataRepresentation, context?: NamedDataResolveContext): Promise<NamedDataBody>;
    clearSession(): Promise<void>;
    private resolveProvider;
    private releaseHandlesForProvider;
}
export declare function installNamedDataRegistry(runtime: object): NamedDataRegistryService;
export declare function getNamedDataRegistry(runtime: object): NamedDataRegistryService | undefined;
export declare function bindNamedDataRegistryLifecycle(runtime: {
    on(event: string, listener: () => void): void;
    off?(event: string, listener: () => void): void;
}, registry: NamedDataRegistryService): () => void;
