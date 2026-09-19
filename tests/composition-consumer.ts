import {
  NAMED_DATA_CONTRACT_VERSION,
  NAMED_DATA_REGISTRY_MVP_DEFAULT,
  NamedDataError,
  type NamedDataBody,
  type NamedDataProvider,
  type NamedDataReference,
  type NamedDataRegistryService,
  type NamedDataRepresentation,
  type NamedDataResolveContext,
  getNamedDataRegistry,
  installNamedDataRegistry
} from '@kubohiroya/turbowarp-named-data/composition';

const runtime = {};
const registry: NamedDataRegistryService = installNamedDataRegistry(runtime);
const sameRegistry: NamedDataRegistryService | undefined = getNamedDataRegistry(runtime);
const reference: NamedDataReference = {
  namespace: 'fixture',
  name: 'document',
  kind: 'document',
  scope: 'project'
};
const context: NamedDataResolveContext = {project: runtime};

const provider: NamedDataProvider = {
  namespace: 'fixture',
  kind: 'document',
  canResolve: (_reference: NamedDataReference, representation: NamedDataRepresentation) =>
    representation === 'html',
  stat: (resolvedReference: NamedDataReference) => ({
    reference: resolvedReference,
    nativeRepresentation: 'html',
    representation: 'html',
    mediaType: 'text/html; charset=utf-8',
    revision: 'opaque',
    replayable: true
  }),
  openBody: (resolvedReference: NamedDataReference): NamedDataBody => ({
    reference: resolvedReference,
    nativeRepresentation: 'html',
    representation: 'html',
    mediaType: 'text/html; charset=utf-8',
    revision: 'opaque',
    replayable: true,
    body: new Uint8Array(),
    release: () => undefined
  }),
  release: () => undefined
};

registry.registerProvider(provider);
void registry.stat(reference, 'html', context);
void sameRegistry;
void NAMED_DATA_CONTRACT_VERSION;
void NAMED_DATA_REGISTRY_MVP_DEFAULT;
void NamedDataError;
