import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/preact';
import { Entrada } from './comum';

describe('Entrada (campo com rascunho)', () => {
  it('redesenhar a tela no meio da digitação NÃO apaga o que foi digitado', () => {
    const onConfirmar = vi.fn();
    const { rerender } = render(<Entrada type="number" valor="0" onConfirmar={onConfirmar} />);
    const input = screen.getByRole('spinbutton') as HTMLInputElement;

    fireEvent.input(input, { target: { value: '2' } });
    // A sincronização muda o indicador e o pai redesenha com o MESMO valor salvo.
    rerender(<Entrada type="number" valor="0" onConfirmar={onConfirmar} />);
    rerender(<Entrada type="number" valor="0" onConfirmar={onConfirmar} />);
    expect(input.value).toBe('2');

    fireEvent.change(input, { target: { value: '2' } });
    expect(onConfirmar).toHaveBeenCalledWith('2');
  });

  it('valor salvo que muda de verdade (outro lugar) substitui o campo', () => {
    const { rerender } = render(<Entrada valor="Skar" onConfirmar={() => {}} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    rerender(<Entrada valor="Skar Lionet" onConfirmar={() => {}} />);
    expect(input.value).toBe('Skar Lionet');
  });

  it('confirmar devolvendo false desfaz para o valor salvo', () => {
    render(<Entrada type="number" valor="5" min={0} step={1} onConfirmar={() => false} />);
    const input = screen.getByRole('spinbutton') as HTMLInputElement;
    fireEvent.input(input, { target: { value: '-3' } });
    fireEvent.change(input, { target: { value: '-3' } });
    expect(input.value).toBe('5');
  });
});
