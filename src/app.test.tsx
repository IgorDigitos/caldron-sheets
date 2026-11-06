import { describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/preact';
import { App } from './app';

describe('App (fumaça)', () => {
  it('mostra o título', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Caldron Sheets' })).toBeTruthy();
  });

  it('reage quando a rede cai e volta', () => {
    render(<App />);
    const status = screen.getByTestId('status');
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(status.dataset.online).toBe('false');
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(status.dataset.online).toBe('true');
  });
});
