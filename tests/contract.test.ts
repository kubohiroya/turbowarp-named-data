import {describe, expect, it} from 'vitest';
import schema from '../schemas/named-data-reference.schema.json';
import {
  NAMED_DATA_KINDS,
  NAMED_DATA_REPRESENTATIONS,
  NAMED_DATA_SCOPES,
  NAMED_DATA_SCHEMA_ID_PATTERN,
  NAMED_DATA_SCHEMA_VERSION_PATTERN,
  type NamedDataReference,
  type NamedDataRepresentation
} from '../src/contract.js';
import fixture from './fixtures/named-data-reference.json';
import schemaBoundFixture from './fixtures/named-data-schema-bound-reference.json';

describe('named-data schema fixture', () => {
  it('matches the TypeScript contract enums', () => {
    expect(schema.properties.kind.enum).toEqual(NAMED_DATA_KINDS);
    expect(schema.properties.scope.enum).toEqual(NAMED_DATA_SCOPES);
    expect(schema.properties.representation.enum).toEqual(NAMED_DATA_REPRESENTATIONS);
    const request = fixture as NamedDataReference & {representation: NamedDataRepresentation};
    expect(request).toEqual(fixture);
  });

  it('contains descriptors only, never inline payload fields', () => {
    expect(schema.properties).not.toHaveProperty('body');
    expect(schema.properties).not.toHaveProperty('bytes');
    expect(schema.properties).not.toHaveProperty('base64');
    expect(JSON.stringify(fixture)).not.toMatch(/body|bytes|base64|data:/iu);
  });

  it('defines an optional versioned schemaRef restricted to structured requests', () => {
    expect(schema.$defs.schemaRef.required).toEqual(['id', 'version']);
    expect(schema.$defs.schemaRef.additionalProperties).toBe(false);
    expect(schema.allOf).toHaveLength(1);
    expect(schema.allOf[0]?.then.properties.kind.const).toBe('structured');
    expect(fixture).not.toHaveProperty('schemaRef');
  });

  it('keeps the JSON Schema identity patterns aligned with the runtime contract', () => {
    const idPattern = new RegExp(schema.$defs.schemaRef.properties.id.pattern, 'u');
    const versionPattern = new RegExp(schema.$defs.schemaRef.properties.version.pattern, 'u');
    for (const id of ['com.example.profile', 'a', 'x-1.y', 'Com.example', '1abc', 'a b', '', 'a'.repeat(129)]) {
      expect(idPattern.test(id)).toBe(NAMED_DATA_SCHEMA_ID_PATTERN.test(id));
    }
    for (const version of [
      '0.0.0', '1.2.3', '1.2.3-rc.1', '1.2.3+build.7', '1.2.3-alpha.1+sha.abc', '1.0.0-0a',
      '1', '1.2', 'v1.2.3', '01.2.3', '1.2.3-', '1.2.3-01', '1.2.3+'
    ]) {
      expect(versionPattern.test(version)).toBe(NAMED_DATA_SCHEMA_VERSION_PATTERN.test(version));
    }
  });

  it('carries a schema-bound structured request as identity only', () => {
    const request = schemaBoundFixture as NamedDataReference & {representation: NamedDataRepresentation};
    expect(request.kind).toBe('structured');
    expect(Object.keys(request.schemaRef ?? {})).toEqual(['id', 'version']);
    expect(NAMED_DATA_SCHEMA_ID_PATTERN.test(request.schemaRef?.id ?? '')).toBe(true);
    expect(NAMED_DATA_SCHEMA_VERSION_PATTERN.test(request.schemaRef?.version ?? '')).toBe(true);
    expect(JSON.stringify(schemaBoundFixture)).not.toMatch(/body|bytes|base64|data:|"\$schema"|properties/iu);
  });
});
