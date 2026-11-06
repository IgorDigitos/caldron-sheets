import { describe, expect, it, vi } from 'vitest';
import { BYTES_MAXIMO, dimensoesAlvo, escolherCompressao, ImagemInvalida, LADO_MAXIMO } from './imagem';

describe('dimensoesAlvo', () => {
  it.each([
    [4000, 3000, 400, 300],
    [3000, 4000, 300, 400],
    [1000, 1000, 400, 400],
    [400, 200, 400, 200],
    [120, 80, 120, 80], // nunca aumenta
    [10000, 10, 400, 1], // nunca zera
  ])('%ix%i → %ix%i', (l, a, el, ea) => {
    expect(dimensoesAlvo(l, a)).toEqual({ largura: el, altura: ea });
  });

  it('lado máximo é 400', () => {
    expect(LADO_MAXIMO).toBe(400);
    expect(BYTES_MAXIMO).toBe(150 * 1024);
  });

  it('recusa imagem sem tamanho', () => {
    expect(() => dimensoesAlvo(0, 10)).toThrow(ImagemInvalida);
  });
});

/** Codificador falso: o tamanho do "arquivo" cresce com a área e a qualidade. */
const fakeCodificador = (bytesPorPixel: number) =>
  vi.fn(async (l: number, a: number, q: number) => new Blob([new Uint8Array(Math.round(l * a * q * bytesPorPixel))], { type: 'image/webp' }));

describe('escolherCompressao', () => {
  it('foto pequena cabe na primeira qualidade', async () => {
    const cod = fakeCodificador(0.1);
    const r = await escolherCompressao({ largura: 4000, altura: 3000 }, cod);
    expect(r).toMatchObject({ largura: 400, altura: 300 });
    expect(r.blob.size).toBeLessThanOrEqual(BYTES_MAXIMO);
    expect(cod).toHaveBeenCalledTimes(1);
  });

  it('baixa a qualidade até caber', async () => {
    const cod = fakeCodificador(1.8); // 400×300: q0,85 = 184KB, q0,75 = 162KB, q0,62 = 134KB ✓
    const r = await escolherCompressao({ largura: 4000, altura: 3000 }, cod);
    expect(r.largura).toBe(400);
    expect(r.blob.size).toBeLessThanOrEqual(BYTES_MAXIMO);
    expect(cod).toHaveBeenCalledTimes(3);
    const qualidades = cod.mock.calls.map((c) => c[2]);
    expect(qualidades).toEqual([...qualidades].sort((a, b) => b - a));
  });

  it('reduz o lado quando nem a menor qualidade cabe', async () => {
    const cod = fakeCodificador(5);
    const r = await escolherCompressao({ largura: 4000, altura: 3000 }, cod);
    expect(r.largura).toBeLessThan(400);
    expect(r.blob.size).toBeLessThanOrEqual(BYTES_MAXIMO);
  });

  it('desiste com mensagem clara', async () => {
    const cod = vi.fn(async () => new Blob([new Uint8Array(BYTES_MAXIMO + 1)]));
    await expect(escolherCompressao({ largura: 1000, altura: 1000 }, cod)).rejects.toThrow(
      'Não foi possível deixar a imagem pequena o bastante',
    );
  });
});
