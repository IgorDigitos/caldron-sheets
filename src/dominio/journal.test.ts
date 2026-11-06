import { describe, expect, it } from 'vitest';
import { criarEntrada, editarEntrada, EntradaInvalida, formatarData, hojeISO, ordenarJournal } from './journal';

describe('journal', () => {
  it('cria com a data de hoje por padrão e limpa espaços', () => {
    const agora = new Date(2026, 10, 6, 20, 0).getTime();
    const e = criarEntrada('f1', { titulo: ' Chegada a Vel ', texto: ' Lutamos.  ' }, agora);
    expect(e).toMatchObject({ fichaId: 'f1', data: '2026-11-06', titulo: 'Chegada a Vel', texto: 'Lutamos.' });
    expect('sessao' in e).toBe(false);
  });

  it('guarda o número da sessão', () => {
    expect(criarEntrada('f1', { titulo: 'x', sessao: 3 }).sessao).toBe(3);
  });

  it.each([
    [{ titulo: '', texto: '  ' }, 'título ou um texto'],
    [{ titulo: 'x', data: '06/11/2026' }, 'Data inválida'],
    [{ titulo: 'x', data: '2026-13-45' }, 'Data inválida'],
    [{ titulo: 'x', sessao: 1.5 }, 'Sessão'],
    [{ titulo: 'x', sessao: -1 }, 'Sessão'],
  ])('recusa %o', (dados, msg) => {
    expect(() => criarEntrada('f1', dados)).toThrow(EntradaInvalida);
    expect(() => criarEntrada('f1', dados)).toThrow(msg);
  });

  it('editar mantém id e criadoEm', () => {
    const e = criarEntrada('f1', { titulo: 'a' }, 100);
    const ed = editarEntrada(e, { texto: 'mais', sessao: undefined }, 200);
    expect(ed).toMatchObject({ id: e.id, criadoEm: 100, atualizadoEm: 200, titulo: 'a', texto: 'mais' });
  });

  it('ordena por data e depois pela criação, mais recente primeiro', () => {
    const a = criarEntrada('f', { titulo: 'a', data: '2026-11-01' }, 1);
    const b = criarEntrada('f', { titulo: 'b', data: '2026-11-06' }, 2);
    const c = criarEntrada('f', { titulo: 'c', data: '2026-11-06' }, 3);
    expect(ordenarJournal([a, b, c]).map((e) => e.titulo)).toEqual(['c', 'b', 'a']);
  });

  it('formata datas sem depender do fuso', () => {
    expect(formatarData('2026-01-02')).toBe('02/01/2026');
    expect(hojeISO(new Date(2026, 0, 2, 23, 59))).toBe('2026-01-02');
  });
});
