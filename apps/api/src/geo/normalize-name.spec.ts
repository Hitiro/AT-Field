import { describe, expect, it } from 'vitest';
import { normalizeName } from './normalize-name';

describe('normalizeName', () => {
  it('remove acentos e cedilha', () => {
    expect(normalizeName('Cândido Mota')).toBe('candido mota');
    expect(normalizeName('São João do Itaperiú')).toBe('sao joao do itaperiu');
    expect(normalizeName('Içara')).toBe('icara');
    expect(normalizeName('Guaçuí')).toBe('guacui');
  });

  it('ignora caixa', () => {
    expect(normalizeName('CÂNDIDO MOTA')).toBe('candido mota');
    expect(normalizeName('bRaSíLiA')).toBe('brasilia');
  });

  it('remove espaços nas pontas e colapsa os internos', () => {
    expect(normalizeName('  Pedro   de\tToledo  ')).toBe('pedro de toledo');
  });

  it('mantém apóstrofo e hífen e unifica o apóstrofo tipográfico', () => {
    expect(normalizeName("Alta Floresta D'Oeste")).toBe(
      "alta floresta d'oeste",
    );
    expect(normalizeName('Alta Floresta D’Oeste')).toBe(
      "alta floresta d'oeste",
    );
    expect(normalizeName('Embu-Guaçu')).toBe('embu-guacu');
  });

  it('aceita string vazia ou só espaços', () => {
    expect(normalizeName('')).toBe('');
    expect(normalizeName('   ')).toBe('');
  });

  it('é idempotente', () => {
    const once = normalizeName('Olho-d’Água do Borges');
    expect(normalizeName(once)).toBe(once);
  });
});
