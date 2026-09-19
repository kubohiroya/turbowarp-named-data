import {
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
  type NamedDataMetadata,
  type NamedDataProvider,
  type NamedDataProviderRegistration,
  type NamedDataReference,
  type NamedDataRegistryService,
  type NamedDataReleaseReason,
  type NamedDataRepresentation,
  type NamedDataResolveContext
} from './contract.js';

type RuntimeHost = object & {[NAMED_DATA_REGISTRY_SYMBOL]?: unknown};

interface ProviderEntry {
  readonly provider: NamedDataProvider;
  readonly lifetime: 'session' | 'persistent';
}

interface OpenHandle {
  readonly namespace: string;
  readonly release: (reason?: NamedDataReleaseReason) => void | Promise<void>;
}

interface LifecycleBinding {
  readonly registry: NamedDataRegistryService;
  readonly listener: () => void;
  references: number;
}

const LIFECYCLE_SYMBOL = Symbol.for('@kubohiroya/turbowarp-named-data/lifecycle/2.0');

const NAMESPACE_PATTERN = /^[a-z][a-z0-9.-]{0,63}$/u;
const errorCodes = new Set<string>(NAMED_DATA_ERROR_CODES);

export class NamedDataRegistry implements NamedDataRegistryService {
  public readonly contractVersion = NAMED_DATA_CONTRACT_VERSION;
  public readonly symbolKey = NAMED_DATA_REGISTRY_SYMBOL_KEY;
  private readonly providers = new Map<string, ProviderEntry>();
  /** Only release callbacks are retained here; body payloads are never retained. */
  private readonly handles = new Set<OpenHandle>();

  public registerProvider(
    provider: NamedDataProvider,
    options: {readonly lifetime?: 'session' | 'persistent'} = {}
  ): NamedDataProviderRegistration {
    requireNamespace(provider.namespace);
    if (this.providers.has(provider.namespace)) {
      throw new NamedDataError(
        'NAMED_DATA_NAMESPACE_CONFLICT',
        `Namespace is already registered: ${provider.namespace}`
      );
    }
    if (!NAMED_DATA_KINDS.includes(provider.kind)) {
      throw new NamedDataError('NAMED_DATA_INVALID_REF', `Unknown provider kind: ${provider.kind}`);
    }
    const entry = {provider, lifetime: options.lifetime ?? 'session'} as const;
    this.providers.set(provider.namespace, entry);
    let active = true;
    return {
      namespace: provider.namespace,
      unregister: async () => {
        if (!active) return;
        active = false;
        if (this.providers.get(provider.namespace) === entry) {
          this.providers.delete(provider.namespace);
          await this.releaseHandlesForNamespace(provider.namespace);
          await provider.release('shutdown');
        }
      }
    };
  }

  public canResolve(
    reference: NamedDataReference,
    representation: NamedDataRepresentation
  ): boolean {
    try {
      validateReferenceShape(reference, representation);
      const provider = this.providers.get(reference.namespace)?.provider;
      return provider?.kind === reference.kind && provider.canResolve(reference, representation);
    } catch {
      return false;
    }
  }

  public async stat(
    reference: NamedDataReference,
    representation: NamedDataRepresentation,
    context: NamedDataResolveContext = {}
  ): Promise<NamedDataMetadata> {
    const provider = this.resolveProvider(reference, representation, context);
    throwIfAborted(context.signal);
    try {
      const metadata = await provider.stat(reference, representation, context);
      throwIfAborted(context.signal);
      validateMetadata(metadata, reference, representation);
      return metadata;
    } catch (error) {
      throw normalizeProviderError(error);
    }
  }

  public async openBody(
    reference: NamedDataReference,
    representation: NamedDataRepresentation,
    context: NamedDataResolveContext = {}
  ): Promise<NamedDataBody> {
    const provider = this.resolveProvider(reference, representation, context);
    throwIfAborted(context.signal);
    let opened: NamedDataBody;
    try {
      opened = await provider.openBody(reference, representation, context);
      validateMetadata(opened, reference, representation);
      if (!(opened.body instanceof Uint8Array) && !(opened.body instanceof ReadableStream)) {
        throw new NamedDataError('NAMED_DATA_INVALID_METADATA', 'Provider returned an invalid body.');
      }
    } catch (error) {
      throw normalizeProviderError(error);
    }

    if (context.signal?.aborted) {
      await opened.release('abort');
      throw abortedError();
    }

    let released = false;
    let abortListener: (() => void) | undefined;
    const tracked: OpenHandle = {
      namespace: reference.namespace,
      release: async (reason = 'complete') => {
        if (released) return;
        released = true;
        if (abortListener && context.signal) {
          context.signal.removeEventListener('abort', abortListener);
        }
        this.handles.delete(tracked);
        await opened.release(reason);
      }
    };
    this.handles.add(tracked);
    if (context.signal) {
      abortListener = () => {
        void Promise.resolve(tracked.release('abort')).catch(() => undefined);
      };
      context.signal.addEventListener('abort', abortListener, {once: true});
      if (context.signal.aborted) {
        await tracked.release('abort');
        throw abortedError();
      }
    }
    return Object.freeze({
      reference: Object.freeze({...opened.reference}),
      nativeRepresentation: opened.nativeRepresentation,
      representation: opened.representation,
      mediaType: opened.mediaType,
      ...(opened.byteLength === undefined ? {} : {byteLength: opened.byteLength}),
      ...(opened.digest === undefined ? {} : {digest: opened.digest}),
      revision: opened.revision,
      replayable: opened.replayable,
      body: opened.body,
      release: tracked.release
    });
  }

  public async clearSession(): Promise<void> {
    const handles = [...this.handles];
    this.handles.clear();
    await Promise.allSettled(handles.map((handle) => handle.release('shutdown')));

    const sessionEntries = [...this.providers.entries()].filter(
      ([, entry]) => entry.lifetime === 'session'
    );
    for (const [namespace] of sessionEntries) this.providers.delete(namespace);
    await Promise.allSettled(
      sessionEntries.map(([, entry]) => entry.provider.release('shutdown'))
    );
    await Promise.allSettled(
      [...this.providers.values()].map((entry) => entry.provider.clearSession?.())
    );
  }

  private resolveProvider(
    reference: NamedDataReference,
    representation: NamedDataRepresentation,
    context: NamedDataResolveContext
  ): NamedDataProvider {
    validateReference(reference, representation, context);
    const provider = this.providers.get(reference.namespace)?.provider;
    if (!provider) {
      throw new NamedDataError(
        'NAMED_DATA_PROVIDER_NOT_FOUND',
        `No provider can resolve namespace: ${reference.namespace}`
      );
    }
    if (provider.kind !== reference.kind) {
      throw new NamedDataError(
        'NAMED_DATA_KIND_MISMATCH',
        `Provider kind ${provider.kind} does not match ${reference.kind}.`
      );
    }
    if (!provider.canResolve(reference, representation)) {
      throw new NamedDataError(
        'NAMED_DATA_REPRESENTATION_UNSUPPORTED',
        `Provider ${reference.namespace} does not support representation: ${representation}`
      );
    }
    return provider;
  }

  private async releaseHandlesForNamespace(namespace: string): Promise<void> {
    const handles = [...this.handles].filter((handle) => handle.namespace === namespace);
    await Promise.allSettled(handles.map((handle) => handle.release('shutdown')));
  }
}

export function installNamedDataRegistry(runtime: object): NamedDataRegistryService {
  const host = runtime as RuntimeHost;
  const existing = host[NAMED_DATA_REGISTRY_SYMBOL];
  if (existing !== undefined) return requireCompatibleRegistry(existing);
  const registry = new NamedDataRegistry();
  Object.defineProperty(host, NAMED_DATA_REGISTRY_SYMBOL, {
    configurable: true,
    enumerable: false,
    writable: false,
    value: registry
  });
  return registry;
}

export function getNamedDataRegistry(runtime: object): NamedDataRegistryService | undefined {
  const existing = (runtime as RuntimeHost)[NAMED_DATA_REGISTRY_SYMBOL];
  return existing === undefined ? undefined : requireCompatibleRegistry(existing);
}

export function bindNamedDataRegistryLifecycle(
  runtime: {on(event: string, listener: () => void): void; off?(event: string, listener: () => void): void},
  registry: NamedDataRegistryService
): () => void {
  const host = runtime as typeof runtime & {[LIFECYCLE_SYMBOL]?: unknown};
  const existing = host[LIFECYCLE_SYMBOL] as LifecycleBinding | undefined;
  if (existing !== undefined) {
    if (existing.registry !== registry) {
      throw new NamedDataError(
        'NAMED_DATA_INCOMPATIBLE_VERSION',
        'Runtime already has a lifecycle binding for a different registry.'
      );
    }
    existing.references += 1;
    return lifecycleUnbind(runtime, host, existing);
  }
  const listener = (): void => {
    void registry.clearSession();
  };
  runtime.on('PROJECT_STOP_ALL', listener);
  const binding: LifecycleBinding = {registry, listener, references: 1};
  Object.defineProperty(host, LIFECYCLE_SYMBOL, {
    configurable: true,
    enumerable: false,
    writable: false,
    value: binding
  });
  return lifecycleUnbind(runtime, host, binding);
}

function lifecycleUnbind(
  runtime: {off?(event: string, listener: () => void): void},
  host: {[LIFECYCLE_SYMBOL]?: unknown},
  binding: LifecycleBinding
): () => void {
  let active = true;
  return () => {
    if (!active || host[LIFECYCLE_SYMBOL] !== binding) return;
    active = false;
    binding.references -= 1;
    if (binding.references > 0) return;
    if (runtime.off) {
      runtime.off('PROJECT_STOP_ALL', binding.listener);
      delete host[LIFECYCLE_SYMBOL];
    }
  };
}

function requireCompatibleRegistry(value: unknown): NamedDataRegistryService {
  if (isCompatibleRegistry(value)) return value;
  throw new NamedDataError(
    'NAMED_DATA_INCOMPATIBLE_VERSION',
    `Runtime slot ${NAMED_DATA_REGISTRY_SYMBOL_KEY} contains an incompatible service.`
  );
}

function isCompatibleRegistry(value: unknown): value is NamedDataRegistryService {
  if (typeof value !== 'object' || value === null) return false;
  try {
    const candidate = value as Partial<NamedDataRegistryService>;
    return (
      candidate.contractVersion === NAMED_DATA_CONTRACT_VERSION &&
      candidate.symbolKey === NAMED_DATA_REGISTRY_SYMBOL_KEY &&
      typeof candidate.registerProvider === 'function' &&
      typeof candidate.canResolve === 'function' &&
      typeof candidate.stat === 'function' &&
      typeof candidate.openBody === 'function' &&
      typeof candidate.clearSession === 'function'
    );
  } catch {
    return false;
  }
}

function validateReference(
  reference: NamedDataReference,
  representation: NamedDataRepresentation,
  context: NamedDataResolveContext
): void {
  validateReferenceShape(reference, representation);
  if (reference.scope === 'target' && context.target === undefined) {
    throw new NamedDataError('NAMED_DATA_SCOPE_MISMATCH', 'Target scope requires target context.');
  }
  if (reference.scope === 'project' && context.project === undefined) {
    throw new NamedDataError('NAMED_DATA_SCOPE_MISMATCH', 'Project scope requires project context.');
  }
  throwIfAborted(context.signal);
}

function validateReferenceShape(
  reference: NamedDataReference,
  representation: NamedDataRepresentation
): void {
  if (!reference || typeof reference !== 'object') throw invalidReference();
  requireNamespace(reference.namespace);
  if (
    typeof reference.name !== 'string' ||
    reference.name.length === 0 ||
    reference.name.length > 256 ||
    containsControlCharacter(reference.name) ||
    !NAMED_DATA_KINDS.includes(reference.kind) ||
    !NAMED_DATA_SCOPES.includes(reference.scope) ||
    !NAMED_DATA_REPRESENTATIONS.includes(representation)
  ) {
    throw invalidReference();
  }
}

function validateMetadata(
  metadata: NamedDataMetadata,
  reference: NamedDataReference,
  representation: NamedDataRepresentation
): void {
  if (
    metadata.representation !== representation ||
    !isNativeRepresentation(metadata.reference.kind, metadata.nativeRepresentation) ||
    metadata.reference.namespace !== reference.namespace ||
    metadata.reference.name !== reference.name ||
    metadata.reference.kind !== reference.kind ||
    metadata.reference.scope !== reference.scope ||
    typeof metadata.mediaType !== 'string' ||
    metadata.mediaType.length === 0 ||
    typeof metadata.revision !== 'string' ||
    metadata.revision.length === 0 ||
    typeof metadata.replayable !== 'boolean' ||
    (metadata.byteLength !== undefined &&
      (!Number.isSafeInteger(metadata.byteLength) || metadata.byteLength < 0)) ||
    (metadata.digest !== undefined && !/^sha256-[A-Za-z0-9_-]+$/u.test(metadata.digest))
  ) {
    throw new NamedDataError('NAMED_DATA_INVALID_METADATA', 'Provider returned invalid metadata.');
  }
}

function isNativeRepresentation(
  kind: NamedDataReference['kind'],
  representation: NamedDataRepresentation
): boolean {
  if (kind === 'structured') return representation === 'json' || representation === 'yaml';
  if (kind === 'document') return representation === 'html' || representation === 'markdown';
  return representation === 'raw';
}

function requireNamespace(namespace: string): void {
  if (typeof namespace !== 'string' || !NAMESPACE_PATTERN.test(namespace)) {
    throw invalidReference('Invalid namespace.');
  }
}

function containsControlCharacter(value: string): boolean {
  return [...value].some((character) => {
    const code = character.codePointAt(0) ?? 0;
    return code <= 31 || code === 127;
  });
}

function invalidReference(message = 'Invalid named-data reference.'): NamedDataError {
  return new NamedDataError('NAMED_DATA_INVALID_REF', message);
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortedError();
}

function abortedError(): NamedDataError {
  return new NamedDataError('NAMED_DATA_ABORTED', 'Named-data operation was aborted.');
}

function normalizeProviderError(error: unknown): NamedDataError {
  if (error instanceof NamedDataError) return error;
  if (
    error instanceof Error &&
    'code' in error &&
    typeof error.code === 'string' &&
    errorCodes.has(error.code)
  ) {
    return new NamedDataError(error.code as NamedDataErrorCode, error.message, {cause: error});
  }
  return new NamedDataError('NAMED_DATA_PROVIDER_RELEASED', 'Provider operation failed.', {
    cause: error
  });
}
