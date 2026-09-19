import {describe, expect, it, vi} from 'vitest';
import {
  NAMED_DATA_REGISTRY_SYMBOL,
  NamedDataError,
  type NamedDataBody,
  type NamedDataMetadata,
  type NamedDataProvider,
  type NamedDataReference,
  type NamedDataRepresentation
} from '../src/contract.js';
import {
  bindNamedDataRegistryLifecycle,
  getNamedDataRegistry,
  installNamedDataRegistry,
  NamedDataRegistry
} from '../src/registry.js';

const targetReference: NamedDataReference = {
  namespace: 'structured', name: 'profile', kind: 'structured', scope: 'target'
};

function provider(
  namespace = 'structured',
  kind: NamedDataProvider['kind'] = 'structured'
): NamedDataProvider & {
  releaseMock: ReturnType<typeof vi.fn>;
  bodyRelease: ReturnType<typeof vi.fn>;
  clearSessionMock: ReturnType<typeof vi.fn>;
} {
  const bodyRelease = vi.fn();
  const releaseMock = vi.fn();
  const clearSessionMock = vi.fn();
  const metadata = (reference: NamedDataReference, representation: NamedDataRepresentation): NamedDataMetadata => ({
    reference: {...reference}, nativeRepresentation: representation, representation, mediaType: 'application/json; charset=utf-8',
    byteLength: 2, revision: 'opaque:r7', replayable: true
  });
  return {
    namespace, kind, canResolve: () => true,
    stat: (reference, representation) => metadata(reference, representation),
    openBody: (reference, representation): NamedDataBody => ({
      ...metadata(reference, representation), body: new Uint8Array([123, 125]), release: bodyRelease
    }),
    release: releaseMock, clearSession: clearSessionMock,
    releaseMock, bodyRelease, clearSessionMock
  };
}

describe('NamedDataRegistry', () => {
  it('shares one registry between independent callers', () => {
    const runtime = {};
    const first = installNamedDataRegistry(runtime);
    expect(installNamedDataRegistry(runtime)).toBe(first);
    expect(getNamedDataRegistry(runtime)).toBe(first);
    expect(Object.getOwnPropertySymbols(runtime)).toContain(NAMED_DATA_REGISTRY_SYMBOL);
  });

  it('rejects an invalid value in the shared runtime slot', () => {
    const runtime = {[NAMED_DATA_REGISTRY_SYMBOL]: {}};
    expect(() => installNamedDataRegistry(runtime)).toThrowError(
      expect.objectContaining({code: 'NAMED_DATA_INVALID_REGISTRY'})
    );
  });

  it('rejects a registry-shaped value with missing service methods', () => {
    const runtime = {
      [NAMED_DATA_REGISTRY_SYMBOL]: {
        registerProvider: () => undefined
      }
    };
    expect(() => getNamedDataRegistry(runtime)).toThrowError(
      expect.objectContaining({code: 'NAMED_DATA_INVALID_REGISTRY'})
    );
  });

  it('rejects a duplicate namespace-kind provider and releases on unregister', async () => {
    const registry = new NamedDataRegistry();
    const first = provider();
    const registration = registry.registerProvider(first);
    expect(() => registry.registerProvider(provider())).toThrowError(
      expect.objectContaining({code: 'NAMED_DATA_PROVIDER_CONFLICT'})
    );
    await registration.unregister();
    await registration.unregister();
    expect(first.releaseMock).toHaveBeenCalledTimes(1);
  });

  it('dispatches different kinds registered in the same namespace', async () => {
    const registry = new NamedDataRegistry();
    const structured = provider('shared', 'structured');
    const asset = provider('shared', 'asset');
    registry.registerProvider(structured);
    registry.registerProvider(asset);

    const structuredReference = {...targetReference, namespace: 'shared'};
    const assetReference = {...targetReference, namespace: 'shared', kind: 'asset' as const};
    await expect(
      registry.stat(structuredReference, 'json', {target: {}})
    ).resolves.toMatchObject({reference: structuredReference});
    await expect(
      registry.stat(assetReference, 'raw', {target: {}})
    ).resolves.toMatchObject({reference: assetReference});
  });

  it('unregisters and releases handles for only one namespace-kind pair', async () => {
    const registry = new NamedDataRegistry();
    const structured = provider('shared', 'structured');
    const asset = provider('shared', 'asset');
    const structuredRegistration = registry.registerProvider(structured);
    registry.registerProvider(asset);
    await registry.openBody(
      {...targetReference, namespace: 'shared'},
      'json',
      {target: {}}
    );
    await registry.openBody(
      {...targetReference, namespace: 'shared', kind: 'asset'},
      'raw',
      {target: {}}
    );

    await structuredRegistration.unregister();

    expect(structured.bodyRelease).toHaveBeenCalledWith('shutdown');
    expect(asset.bodyRelease).not.toHaveBeenCalled();
    expect(registry.canResolve({...targetReference, namespace: 'shared'}, 'json')).toBe(false);
    expect(registry.canResolve({...targetReference, namespace: 'shared', kind: 'asset'}, 'raw')).toBe(true);
  });

  it('releases namespace handles before unregistering their provider', async () => {
    const registry = new NamedDataRegistry();
    const source = provider();
    const registration = registry.registerProvider(source);
    await registry.openBody(targetReference, 'json', {target: {}});
    await registration.unregister();
    expect(source.bodyRelease).toHaveBeenCalledWith('shutdown');
    expect(source.releaseMock).toHaveBeenCalledTimes(1);
  });

  it('keeps target and project resolution contexts distinct', async () => {
    const registry = new NamedDataRegistry();
    registry.registerProvider(provider());
    await expect(registry.stat(targetReference, 'json', {project: {}})).rejects.toMatchObject({code: 'NAMED_DATA_SCOPE_MISMATCH'});
    const projectReference = {...targetReference, scope: 'project' as const};
    await expect(registry.stat(projectReference, 'json', {target: {}})).rejects.toMatchObject({code: 'NAMED_DATA_SCOPE_MISMATCH'});
    await expect(registry.stat(targetReference, 'json', {target: {}})).resolves.toMatchObject({revision: 'opaque:r7'});
  });

  it('distinguishes a missing provider from an unsupported representation', async () => {
    const registry = new NamedDataRegistry();
    await expect(
      registry.stat(targetReference, 'json', {target: {}})
    ).rejects.toMatchObject({code: 'NAMED_DATA_PROVIDER_NOT_FOUND'});

    const source = provider();
    source.canResolve = (_reference, representation) => representation === 'json';
    registry.registerProvider(source);
    await expect(
      registry.stat(targetReference, 'yaml', {target: {}})
    ).rejects.toMatchObject({code: 'NAMED_DATA_REPRESENTATION_UNSUPPORTED'});
  });

  it('releases an opened body once', async () => {
    const registry = new NamedDataRegistry();
    const source = provider();
    registry.registerProvider(source, {lifetime: 'persistent'});
    const body = await registry.openBody(targetReference, 'json', {target: {}});
    expect(body.body).toEqual(new Uint8Array([123, 125]));
    await body.release('complete');
    await body.release('cancel');
    expect(source.bodyRelease).toHaveBeenCalledTimes(1);
  });

  it('reports abort with a stable code', async () => {
    const registry = new NamedDataRegistry();
    const source = provider();
    registry.registerProvider(source);
    const controller = new AbortController();
    controller.abort();
    await expect(registry.openBody(targetReference, 'json', {target: {}, signal: controller.signal})).rejects.toMatchObject({code: 'NAMED_DATA_ABORTED'});
    expect(source.bodyRelease).not.toHaveBeenCalled();
  });

  it('releases an open body when its signal is aborted later', async () => {
    const registry = new NamedDataRegistry();
    const source = provider();
    registry.registerProvider(source, {lifetime: 'persistent'});
    const controller = new AbortController();
    await registry.openBody(targetReference, 'json', {target: {}, signal: controller.signal});
    controller.abort();
    await vi.waitFor(() => expect(source.bodyRelease).toHaveBeenCalledWith('abort'));
  });

  it('cleans session providers, open handles, and persistent session state', async () => {
    const registry = new NamedDataRegistry();
    const session = provider('structured');
    const persistent = provider('documents');
    registry.registerProvider(session);
    registry.registerProvider(persistent, {lifetime: 'persistent'});
    await registry.openBody(targetReference, 'json', {target: {}});
    await registry.clearSession();
    expect(session.bodyRelease).toHaveBeenCalledWith('shutdown');
    expect(session.releaseMock).toHaveBeenCalledWith('shutdown');
    expect(persistent.releaseMock).not.toHaveBeenCalled();
    expect(persistent.clearSessionMock).toHaveBeenCalledOnce();
  });

  it('binds cleanup to PROJECT_STOP_ALL', async () => {
    const registry = new NamedDataRegistry();
    const clear = vi.spyOn(registry, 'clearSession').mockResolvedValue();
    let listener: (() => void) | undefined;
    const runtime = {on: (_event: string, next: () => void) => (listener = next), off: vi.fn()};
    const unbind = bindNamedDataRegistryLifecycle(runtime, registry);
    listener?.();
    await vi.waitFor(() => expect(clear).toHaveBeenCalledOnce());
    unbind();
    expect(runtime.off).toHaveBeenCalledWith('PROJECT_STOP_ALL', listener);
  });

  it('keeps a shared lifecycle binding until every consumer unbinds', () => {
    const registry = new NamedDataRegistry();
    const runtime = {on: vi.fn(), off: vi.fn()};
    const unbindFirst = bindNamedDataRegistryLifecycle(runtime, registry);
    const unbindSecond = bindNamedDataRegistryLifecycle(runtime, registry);

    expect(runtime.on).toHaveBeenCalledOnce();
    unbindFirst();
    unbindFirst();
    expect(runtime.off).not.toHaveBeenCalled();
    unbindSecond();
    expect(runtime.off).toHaveBeenCalledOnce();
  });

  it('reuses the lifecycle listener when the runtime cannot remove listeners', () => {
    const registry = new NamedDataRegistry();
    const runtime = {on: vi.fn()};
    const unbindFirst = bindNamedDataRegistryLifecycle(runtime, registry);

    unbindFirst();
    const unbindSecond = bindNamedDataRegistryLifecycle(runtime, registry);

    expect(runtime.on).toHaveBeenCalledOnce();
    unbindSecond();
  });

  it('rejects an invalid shared lifecycle binding', () => {
    const registry = new NamedDataRegistry();
    const runtime = {
      on: vi.fn(),
      [Symbol.for('@kubohiroya/turbowarp-named-data/lifecycle')]: {registry}
    };

    expect(() => bindNamedDataRegistryLifecycle(runtime, registry)).toThrowError(
      expect.objectContaining({code: 'NAMED_DATA_INVALID_REGISTRY'})
    );
    expect(runtime.on).not.toHaveBeenCalled();
  });

  it('normalizes compatible provider error codes and masks arbitrary failures', async () => {
    const registry = new NamedDataRegistry();
    const source = provider();
    source.stat = () => { throw Object.assign(new Error('missing'), {code: 'NAMED_DATA_NOT_FOUND'}); };
    registry.registerProvider(source);
    await expect(registry.stat(targetReference, 'json', {target: {}})).rejects.toMatchObject({code: 'NAMED_DATA_NOT_FOUND'});
    source.stat = () => { throw new Error('secret provider details'); };
    await expect(registry.stat(targetReference, 'json', {target: {}})).rejects.toEqual(expect.any(NamedDataError));
  });
});
