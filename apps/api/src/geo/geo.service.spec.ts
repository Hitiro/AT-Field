import { describe, expect, it } from 'vitest';
import { escapeLike, matchesEtag } from './geo.service';

describe('escapeLike', () => {
  it('escapa %, _ e a barra invertida', () => {
    expect(escapeLike('100%')).toBe('100\\%');
    expect(escapeLike('a_b')).toBe('a\\_b');
    expect(escapeLike('a\\b')).toBe('a\\\\b');
    expect(escapeLike('%_\\')).toBe('\\%\\_\\\\');
  });

  it('mantém texto comum, apóstrofo e hífen', () => {
    expect(escapeLike("alta floresta d'oeste")).toBe("alta floresta d'oeste");
    expect(escapeLike('embu-guacu')).toBe('embu-guacu');
  });
});

describe('matchesEtag', () => {
  const etag = '"ibge-2026-10"';

  it('casa ETag igual, fraco, em lista ou curinga', () => {
    expect(matchesEtag('"ibge-2026-10"', etag)).toBe(true);
    expect(matchesEtag('W/"ibge-2026-10"', etag)).toBe(true);
    expect(matchesEtag('"x", "ibge-2026-10"', etag)).toBe(true);
    expect(matchesEtag('*', etag)).toBe(true);
  });

  it('não casa versão diferente ou cabeçalho ausente', () => {
    expect(matchesEtag('"ibge-2026-04"', etag)).toBe(false);
    expect(matchesEtag('ibge-2026-10', etag)).toBe(false);
    expect(matchesEtag(undefined, etag)).toBe(false);
    expect(matchesEtag('', etag)).toBe(false);
  });
});
