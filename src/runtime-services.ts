/**
 * The runtime services this extension registers, as its own build artifact.
 *
 * This used to live in dist/extension-manifest.json under a formatVersion of 2. That was a
 * different axis from the block API the manifest describes, and it collided with an unrelated
 * format version 2 that two other extensions had defined for block-level compiler metadata. Nothing
 * outside this repository read it, so it moves here instead of into the shared contract.
 */
export const RUNTIME_SERVICES_FORMAT_VERSION = 1 as const;

export interface RuntimeService {
  id: string;
  symbolKey: string;
  featureFlag: string;
  defaultEnabled: boolean;
}

export interface RuntimeServicesArtifact {
  formatVersion: typeof RUNTIME_SERVICES_FORMAT_VERSION;
  runtimeServices: RuntimeService[];
}

export function createRuntimeServices(definitions: unknown): RuntimeServicesArtifact {
  const source = requireRecord(definitions, 'Block definitions');
  return {
    formatVersion: RUNTIME_SERVICES_FORMAT_VERSION,
    runtimeServices: normalizeRuntimeServices(source['runtimeServices'])
  };
}

export function serializeRuntimeServices(definitions: unknown): string {
  return `${JSON.stringify(createRuntimeServices(definitions), null, 2)}\n`;
}

function normalizeRuntimeServices(value: unknown): RuntimeService[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new TypeError('Runtime services must be an array.');
  const seen = new Set<string>();
  return value
    .map((item, index) => {
      const service = requireRecord(item, `Runtime service at index ${index}`);
      const id = requireNonEmptyString(service['id'], `Runtime service at index ${index} ID`);
      if (seen.has(id)) throw new TypeError(`Duplicate runtime service ID: ${id}`);
      seen.add(id);
      const defaultEnabled = service['defaultEnabled'];
      if (typeof defaultEnabled !== 'boolean') {
        throw new TypeError(`Runtime service ${id} defaultEnabled must be a boolean.`);
      }
      return {
        id,
        symbolKey: requireNonEmptyString(service['symbolKey'], `Runtime service ${id} symbolKey`),
        featureFlag: requireNonEmptyString(service['featureFlag'], `Runtime service ${id} featureFlag`),
        defaultEnabled
      };
    })
    .sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function requireNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${label} must be a non-empty string.`);
  }
  return value;
}
