export const NAMED_DATA_REGISTRY_SYMBOL_KEY =
  '@kubohiroya/turbowarp-named-data/registry' as const;
export const NAMED_DATA_REGISTRY_SYMBOL = Symbol.for(NAMED_DATA_REGISTRY_SYMBOL_KEY);

export const NAMED_DATA_NAMESPACE_PATTERN = /^[a-z][a-z0-9.-]{0,63}$/u;

export function isNamedDataNamespace(value: unknown): value is string {
  return typeof value === 'string' && NAMED_DATA_NAMESPACE_PATTERN.test(value);
}

export const NAMED_DATA_KINDS = ['structured', 'document', 'binary', 'asset'] as const;
export const NAMED_DATA_SCOPES = ['target', 'project'] as const;
export const NAMED_DATA_REPRESENTATIONS = ['json', 'yaml', 'html', 'markdown', 'raw'] as const;

export const NAMED_DATA_ERROR_CODES = [
  'NAMED_DATA_INVALID_REF',
  'NAMED_DATA_INVALID_REGISTRY',
  'NAMED_DATA_PROVIDER_CONFLICT',
  'NAMED_DATA_PROVIDER_NOT_FOUND',
  'NAMED_DATA_NOT_FOUND',
  'NAMED_DATA_KIND_MISMATCH',
  'NAMED_DATA_SCOPE_MISMATCH',
  'NAMED_DATA_REPRESENTATION_UNSUPPORTED',
  'NAMED_DATA_INVALID_METADATA',
  'NAMED_DATA_BODY_TOO_LARGE',
  'NAMED_DATA_ABORTED',
  'NAMED_DATA_PROVIDER_RELEASED'
] as const;

export type NamedDataKind = (typeof NAMED_DATA_KINDS)[number];
export type NamedDataScope = (typeof NAMED_DATA_SCOPES)[number];
export type NamedDataRepresentation = (typeof NAMED_DATA_REPRESENTATIONS)[number];
export type NamedDataErrorCode = (typeof NAMED_DATA_ERROR_CODES)[number];
export type NamedDataReleaseReason = 'complete' | 'cancel' | 'abort' | 'error' | 'shutdown';

export interface NamedDataReference {
  readonly namespace: string;
  readonly name: string;
  readonly kind: NamedDataKind;
  readonly scope: NamedDataScope;
}

export interface NamedDataResolveContext {
  /** Runtime-local identity. Required only for target-scoped references. */
  readonly target?: object;
  /** Runtime-local project identity. Required only for project-scoped references. */
  readonly project?: object;
  readonly signal?: AbortSignal;
}

export interface NamedDataMetadata {
  readonly reference: NamedDataReference;
  /** Representation retained by the provider as the named value's native form. */
  readonly nativeRepresentation: NamedDataRepresentation;
  /** Representation selected for this resolved body. */
  readonly representation: NamedDataRepresentation;
  readonly mediaType: string;
  readonly byteLength?: number;
  readonly digest?: `sha256-${string}`;
  /** Opaque provider revision. Consumers must not parse or order this value. */
  readonly revision: string;
  readonly replayable: boolean;
}

export interface NamedDataBody extends NamedDataMetadata {
  readonly body: Uint8Array | ReadableStream<Uint8Array>;
  release(reason?: NamedDataReleaseReason): void | Promise<void>;
}

export interface NamedDataProvider {
  readonly namespace: string;
  readonly kind: NamedDataKind;
  canResolve(reference: NamedDataReference, representation: NamedDataRepresentation): boolean;
  stat(
    reference: NamedDataReference,
    representation: NamedDataRepresentation,
    context: NamedDataResolveContext
  ): NamedDataMetadata | Promise<NamedDataMetadata>;
  openBody(
    reference: NamedDataReference,
    representation: NamedDataRepresentation,
    context: NamedDataResolveContext
  ): NamedDataBody | Promise<NamedDataBody>;
  /** Release all provider-owned resources. Must be idempotent. */
  release(reason?: NamedDataReleaseReason): void | Promise<void>;
  /** Drop project-session state while retaining a persistent registration. */
  clearSession?(): void | Promise<void>;
}

export interface NamedDataProviderRegistration {
  readonly namespace: string;
  readonly kind: NamedDataKind;
  unregister(): Promise<void>;
}

export interface NamedDataRegistryService {
  registerProvider(
    provider: NamedDataProvider,
    options?: {readonly lifetime?: 'session' | 'persistent'}
  ): NamedDataProviderRegistration;
  canResolve(reference: NamedDataReference, representation: NamedDataRepresentation): boolean;
  stat(
    reference: NamedDataReference,
    representation: NamedDataRepresentation,
    context?: NamedDataResolveContext
  ): Promise<NamedDataMetadata>;
  openBody(
    reference: NamedDataReference,
    representation: NamedDataRepresentation,
    context?: NamedDataResolveContext
  ): Promise<NamedDataBody>;
  clearSession(): Promise<void>;
}

export class NamedDataError extends Error {
  public constructor(
    public readonly code: NamedDataErrorCode,
    message: string,
    options?: ErrorOptions
  ) {
    super(`${code}: ${message}`, options);
    this.name = 'NamedDataError';
  }
}
