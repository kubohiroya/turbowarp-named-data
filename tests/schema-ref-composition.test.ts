import {describe, expect, it, vi} from 'vitest';
import {
  NamedDataError,
  bindNamedDataRegistryLifecycle,
  getNamedDataRegistry,
  installNamedDataRegistry,
  type NamedDataBody,
  type NamedDataMetadata,
  type NamedDataProvider,
  type NamedDataReference,
  type NamedDataRepresentation,
  type NamedDataResolveContext,
  type NamedDataSchemaRef
} from '../src/composition.js';

interface Binding {
  value: unknown;
  revision: number;
  schemaRef?: NamedDataSchemaRef;
}

/** Mirrors how a structured-data provider exposes target-scoped bindings with schema identity. */
function structuredProvider(bindings: WeakMap<object, Map<string, Binding>>): NamedDataProvider & {
  releaseBody: ReturnType<typeof vi.fn>;
} {
  const releaseBody = vi.fn();
  const lookup = (reference: NamedDataReference, context: NamedDataResolveContext): Binding => {
    const binding = context.target && bindings.get(context.target)?.get(reference.name);
    if (!binding) throw new NamedDataError('NAMED_DATA_NOT_FOUND', reference.name);
    return binding;
  };
  const metadata = (
    reference: NamedDataReference,
    representation: NamedDataRepresentation,
    binding: Binding
  ): NamedDataMetadata => ({
    reference: {...reference},
    ...(binding.schemaRef ? {schemaRef: binding.schemaRef} : {}),
    nativeRepresentation: 'json',
    representation,
    mediaType: 'application/json; charset=utf-8',
    revision: `structured:${binding.revision}`,
    replayable: true
  });
  return {
    namespace: 'structured',
    kind: 'structured',
    canResolve: (_reference, representation) => representation === 'json',
    stat: (reference, representation, context) =>
      metadata(reference, representation, lookup(reference, context)),
    openBody: (reference, representation, context): NamedDataBody => {
      const binding = lookup(reference, context);
      return {
        ...metadata(reference, representation, binding),
        body: new TextEncoder().encode(JSON.stringify(binding.value)),
        release: releaseBody
      };
    },
    release: () => undefined,
    releaseBody
  };
}

/** Mirrors a schema-typed consumer such as a named function argument resolver. */
async function readTypedArgument(
  runtime: object,
  target: object,
  name: string,
  expected: NamedDataSchemaRef
): Promise<{value: unknown; schemaRef: NamedDataSchemaRef | undefined}> {
  const registry = getNamedDataRegistry(runtime);
  if (!registry) throw new Error('registry unavailable');
  const reference: NamedDataReference = {
    namespace: 'structured', name, kind: 'structured', scope: 'target', schemaRef: expected
  };
  const opened = await registry.openBody(reference, 'json', {target});
  try {
    const bytes = opened.body as Uint8Array;
    return {value: JSON.parse(new TextDecoder().decode(bytes)), schemaRef: opened.schemaRef};
  } finally {
    await opened.release('complete');
  }
}

describe('schema reference composition', () => {
  const profile = {id: 'com.example.profile', version: '1.0.0'} as const;

  function setup() {
    const listeners = new Set<() => void>();
    const runtime = {
      on: (_event: string, listener: () => void) => listeners.add(listener),
      off: (_event: string, listener: () => void) => listeners.delete(listener)
    };
    const target = {};
    const bindings = new WeakMap<object, Map<string, Binding>>([
      [target, new Map<string, Binding>([
        ['ada', {value: {name: 'Ada'}, revision: 3, schemaRef: {...profile}}],
        ['untyped', {value: [1, 2], revision: 1}]
      ])]
    ]);
    const provider = structuredProvider(bindings);
    // Provider and consumer extensions install independently and share one registry.
    const providerRegistry = installNamedDataRegistry(runtime);
    const unbind = bindNamedDataRegistryLifecycle(runtime, providerRegistry);
    providerRegistry.registerProvider(provider);
    const stop = () => listeners.forEach((listener) => listener());
    return {runtime, target, provider, unbind, stop};
  }

  it('propagates the bound schema identity from provider to consumer', async () => {
    const {runtime, target, provider} = setup();
    await expect(readTypedArgument(runtime, target, 'ada', profile)).resolves.toEqual({
      value: {name: 'Ada'}, schemaRef: profile
    });
    expect(provider.releaseBody).toHaveBeenCalledWith('complete');
  });

  it('fails without fallback when the consumer expects another version', async () => {
    const {runtime, target, provider} = setup();
    await expect(
      readTypedArgument(runtime, target, 'ada', {...profile, version: '2.0.0'})
    ).rejects.toMatchObject({code: 'NAMED_DATA_SCHEMA_VERSION_MISMATCH'});
    await expect(
      readTypedArgument(runtime, target, 'untyped', profile)
    ).rejects.toMatchObject({code: 'NAMED_DATA_SCHEMA_VERSION_MISMATCH'});
    expect(provider.releaseBody).not.toHaveBeenCalled();
  });

  it('keeps untyped references working unchanged', async () => {
    const {runtime, target} = setup();
    const registry = getNamedDataRegistry(runtime);
    const reference: NamedDataReference = {
      namespace: 'structured', name: 'untyped', kind: 'structured', scope: 'target'
    };
    const metadata = await registry?.stat(reference, 'json', {target});
    expect(metadata).toMatchObject({revision: 'structured:1'});
    expect(metadata).not.toHaveProperty('schemaRef');
  });

  it('drops the session provider on project stop', async () => {
    const {runtime, target, stop, unbind} = setup();
    stop();
    await vi.waitFor(() =>
      expect(readTypedArgument(runtime, target, 'ada', profile)).rejects.toMatchObject({
        code: 'NAMED_DATA_PROVIDER_NOT_FOUND'
      })
    );
    unbind();
  });
});
