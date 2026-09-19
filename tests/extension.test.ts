import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {NamedDataExtension} from '../src/extension.js';

const listeners = new Map<string, () => void>();
const runtime = {
  on: (event: string, listener: () => void) => listeners.set(event, listener),
  off: (event: string) => listeners.delete(event)
};

beforeEach(() => {
  listeners.clear();
  vi.stubGlobal('Scratch', {
    BlockType: {BOOLEAN: 'boolean'},
    ArgumentType: {},
    Cast: {},
    translate: (message: string | {default: string}) =>
      typeof message === 'string' ? message : message.default
  });
});

afterEach(() => vi.unstubAllGlobals());

describe('NamedDataExtension', () => {
  it('keeps the feature disabled by default', () => {
    const extension = new NamedDataExtension(runtime, {NAMED_DATA_REGISTRY_MVP: false});
    expect(extension.isRegistryAvailable()).toBe(false);
    expect((extension.getInfo().blocks as unknown[]).length).toBe(0);
  });

  it('installs the registry and block only when explicitly enabled', () => {
    const extension = new NamedDataExtension(runtime, {NAMED_DATA_REGISTRY_MVP: true});
    expect(extension.isRegistryAvailable()).toBe(true);
    expect(extension.getInfo()).toMatchObject({
      id: 'kubohiroyanameddata',
      name: 'Named Data',
      docsURI: 'https://kubohiroya.github.io/turbowarp-named-data/'
    });
    expect((extension.getInfo().blocks as unknown[]).length).toBe(1);
    expect(listeners.has('PROJECT_STOP_ALL')).toBe(true);
    extension.dispose();
    expect(listeners.has('PROJECT_STOP_ALL')).toBe(false);
  });
});
