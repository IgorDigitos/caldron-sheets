import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/preact';
import { BarraRecurso } from './BarraRecurso';

describe('BarraRecurso', () => {
  it('mostra atual / máximo e o medidor', () => {
    render(<BarraRecurso recurso="VIDA" atual={37} max={45} onAplicar={() => {}} />);
    expect(screen.getByTestId('valor-VIDA').textContent).toBe('37 / 45');
    const medidor = screen.getByRole('meter', { name: 'Vida atual' });
    expect(medidor.getAttribute('aria-valuenow')).toBe('37');
    expect(medidor.getAttribute('aria-valuetext')).toBe('37 de 45');
  });

  it('largura da barra é proporcional e fica entre 0 e 100%', () => {
    const { container, rerender } = render(<BarraRecurso recurso="VIDA" atual={9} max={45} onAplicar={() => {}} />);
    const preenchida = () => container.querySelector<HTMLElement>('.barra-preenchida')!.style.width;
    expect(preenchida()).toBe('20%');
    rerender(<BarraRecurso recurso="VIDA" atual={-4} max={45} onAplicar={() => {}} />);
    expect(preenchida()).toBe('0%');
    rerender(<BarraRecurso recurso="VIDA" atual={50} max={45} onAplicar={() => {}} />);
    expect(preenchida()).toBe('100%');
    rerender(<BarraRecurso recurso="VIDA" atual={0} max={0} onAplicar={() => {}} />);
    expect(preenchida()).toBe('0%');
  });

  it('Vida negativa fica destacada', () => {
    render(<BarraRecurso recurso="VIDA" atual={-4} max={45} onAplicar={() => {}} />);
    expect(screen.getByTestId('valor-VIDA').dataset.negativo).toBe('true');
    expect(screen.getByTestId('valor-VIDA').textContent).toBe('-4 / 45');
  });

  it('Dano e Cura enviam o valor digitado e limpam o campo', () => {
    const onAplicar = vi.fn();
    render(<BarraRecurso recurso="VIDA" atual={45} max={45} onAplicar={onAplicar} />);
    const input = screen.getByLabelText('Quantidade de Vida') as HTMLInputElement;

    fireEvent.input(input, { target: { value: '8' } });
    fireEvent.click(screen.getByRole('button', { name: 'Dano' }));
    expect(onAplicar).toHaveBeenLastCalledWith('dano', 8);
    expect(input.value).toBe('');

    fireEvent.input(input, { target: { value: '2,5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cura' }));
    expect(onAplicar).toHaveBeenLastCalledWith('cura', 2.5);
  });

  it('Enter aplica dano', () => {
    const onAplicar = vi.fn();
    render(<BarraRecurso recurso="VIDA" atual={45} max={45} onAplicar={onAplicar} />);
    const input = screen.getByLabelText('Quantidade de Vida');
    fireEvent.input(input, { target: { value: '3' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onAplicar).toHaveBeenCalledWith('dano', 3);
  });

  it.each(['', 'abc', '0', '-5'])('valor "%s" mostra erro e não aplica', (texto) => {
    const onAplicar = vi.fn();
    render(<BarraRecurso recurso="VIDA" atual={45} max={45} onAplicar={onAplicar} />);
    fireEvent.input(screen.getByLabelText('Quantidade de Vida'), { target: { value: texto } });
    fireEvent.click(screen.getByRole('button', { name: 'Dano' }));
    expect(onAplicar).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toBe('Informe um número maior que zero');
  });

  it('STA e Mana usam Gastar / Recuperar', () => {
    const onAplicar = vi.fn();
    render(<BarraRecurso recurso="STA" atual={20} max={20} onAplicar={onAplicar} />);
    fireEvent.input(screen.getByLabelText('Quantidade de Stamina'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Gastar' }));
    expect(onAplicar).toHaveBeenCalledWith('dano', 2);
    expect(screen.getByRole('button', { name: 'Recuperar' })).toBeTruthy();
  });

  it('mostra o selo de extra só quando há extra', () => {
    const { rerender } = render(<BarraRecurso recurso="VIDA" atual={45} max={45} onAplicar={() => {}} />);
    expect(screen.queryByTestId('extra-VIDA')).toBeNull();
    rerender(<BarraRecurso recurso="VIDA" atual={45} max={45} extra={10} onAplicar={() => {}} />);
    expect(screen.getByTestId('extra-VIDA').textContent).toBe('+10 extra');
  });

  it('campo Extra chama onExtra; vazio vira 0; negativo avisa e desfaz', () => {
    const onExtra = vi.fn();
    render(<BarraRecurso recurso="MANA" atual={12} max={12} extra={3} onAplicar={() => {}} onExtra={onExtra} />);
    const campo = screen.getByLabelText('Extra de Mana') as HTMLInputElement;
    expect(campo.value).toBe('3');
    fireEvent.change(campo, { target: { value: '8' } });
    expect(onExtra).toHaveBeenLastCalledWith(8);
    fireEvent.change(campo, { target: { value: '' } });
    expect(onExtra).toHaveBeenLastCalledWith(0);
    fireEvent.change(campo, { target: { value: '-2' } });
    expect(onExtra).toHaveBeenCalledTimes(2);
    expect(campo.value).toBe('3');
    expect(screen.getByRole('alert').textContent).toBe('O extra precisa ser um número maior ou igual a zero');
  });

  it('sem onExtra o campo não aparece', () => {
    render(<BarraRecurso recurso="VIDA" atual={45} max={45} onAplicar={() => {}} />);
    expect(screen.queryByLabelText('Extra de Vida')).toBeNull();
  });
});
