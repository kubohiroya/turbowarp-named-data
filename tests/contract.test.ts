import {describe, expect, it} from 'vitest';
import schema from '../schemas/named-data-reference.schema.json';
import {
  NAMED_DATA_KINDS,
  NAMED_DATA_REPRESENTATIONS,
  NAMED_DATA_SCOPES,
  type NamedDataReference,
  type NamedDataRepresentation
} from '../src/contract.js';
import fixture from './fixtures/named-data-reference.json';

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
});
