import { describe, expect, it } from 'vitest';
import { redirecionamento } from './endereco';

describe('redirecionamento', () => {
  it('firebaseapp.com vai para o web.app mantendo a rota', () => {
    expect(redirecionamento('https://caldron-sheets.firebaseapp.com/')).toBe('https://caldron-sheets.web.app/');
    expect(redirecionamento('https://caldron-sheets.firebaseapp.com/?x=1#/ficha/abc/mesa')).toBe(
      'https://caldron-sheets.web.app/?x=1#/ficha/abc/mesa',
    );
  });

  it.each([
    'https://caldron-sheets.web.app/#/mesa',
    'https://caldron-sheets--pr11-mesa-discord-h94vxsq6.web.app/',
    'http://localhost:4173/',
    'http://192.168.0.10:5173/',
  ])('%s fica onde está', (url) => {
    expect(redirecionamento(url)).toBeNull();
  });
});
