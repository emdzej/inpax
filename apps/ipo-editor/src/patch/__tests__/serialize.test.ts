import { describe, it, expect } from 'vitest';
import { patchToYaml, patchFromYaml } from '../serialize.js';
import type { PatchDocument } from '../types.js';

describe('serialize round-trip', () => {
  const doc: PatchDocument = {
    inpax_patch_version: 1,
    original: {
      name: 'ms43.ipo',
      location: 'inpa',
      checksum: { algorithm: 'sha256', value: 'a'.repeat(64) },
    },
    target_encoding: 'cp1252',
    description: 'Polish translation\nof MS43 status screens',
    patches: [
      {
        index: 1136,
        type: 'string',
        value: 'INICJALIZACJA',
        notes: 'const[1136] in inpainit',
      },
      { index: 1183, type: 'string', value: 'IDENTYFIKACJA' },
      { index: 1, type: 'int', value: 42 },
    ],
  };

  it('survives a write→parse cycle exactly', () => {
    const yaml = patchToYaml(doc);
    const parsed = patchFromYaml(yaml);
    expect(parsed).toEqual(doc);
  });

  it('emits multi-line descriptions using block scalar syntax', () => {
    const yaml = patchToYaml(doc);
    expect(yaml).toMatch(/description: \|/);
  });

  it('rejects YAML that fails schema validation', () => {
    const bad = `
inpax_patch_version: 99
original:
  name: ms43.ipo
  location: inpa
  checksum:
    algorithm: sha256
    value: ${'a'.repeat(64)}
patches: []
`;
    expect(() => patchFromYaml(bad)).toThrow();
  });
});
