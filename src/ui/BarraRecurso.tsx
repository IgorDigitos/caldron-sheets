import { useState } from 'preact/hooks';
import { NOMES_RECURSOS, type Recurso, type TipoMudanca } from '../dominio/ficha';
import { formatar } from '../rules/motor';
import { Entrada } from './comum';

interface Props {
  recurso: Recurso;
  atual: number;
  max: number;
  /** Extra temporário (efeito de item, magia…). */
  extra?: number;
  onAplicar: (tipo: TipoMudanca, valor: number) => void;
  /** Ajuste manual do extra. Sem isto, o campo não aparece. */
  onExtra?: (valor: number) => void;
}

const BOTOES: Record<Recurso, Record<TipoMudanca, string>> = {
  VIDA: { dano: 'Dano', cura: 'Cura' },
  STA: { dano: 'Gastar', cura: 'Recuperar' },
  MANA: { dano: 'Gastar', cura: 'Recuperar' },
};

export function BarraRecurso({ recurso, atual, max, extra = 0, onAplicar, onExtra }: Props) {
  const [texto, setTexto] = useState('');
  const [erro, setErro] = useState('');
  const nome = NOMES_RECURSOS[recurso];
  const pct = max > 0 ? Math.max(0, Math.min(100, (atual / max) * 100)) : 0;
  const idInput = `qtd-${recurso}`;

  const enviar = (tipo: TipoMudanca) => {
    const valor = Number(texto.replace(',', '.'));
    if (!texto.trim() || !Number.isFinite(valor) || valor <= 0) {
      setErro('Informe um número maior que zero');
      return;
    }
    setErro('');
    setTexto('');
    onAplicar(tipo, valor);
  };

  return (
    <section class={`recurso recurso-${recurso.toLowerCase()}`} aria-label={nome}>
      <div class="recurso-topo">
        <span class="recurso-nome">{nome}</span>
        <span class="recurso-valores">
          {extra > 0 && (
            <span class="selo-extra" data-testid={`extra-${recurso}`}>
              +{formatar(extra)} extra
            </span>
          )}
          <span class="recurso-valor" data-testid={`valor-${recurso}`} data-negativo={atual < 0}>
            {formatar(atual)} / {formatar(max)}
          </span>
        </span>
      </div>
      <div
        class="barra"
        role="meter"
        aria-label={`${nome} atual`}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={atual}
        aria-valuetext={`${formatar(atual)} de ${formatar(max)}`}
      >
        <div class="barra-preenchida" style={{ width: `${pct}%` }} />
      </div>
      <div class="recurso-acoes">
        <label class="sr-only" for={idInput}>
          Quantidade de {nome}
        </label>
        <input
          id={idInput}
          type="text"
          inputMode="decimal"
          placeholder="0"
          value={texto}
          onInput={(e) => setTexto(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') enviar('dano');
          }}
        />
        <button type="button" class="btn btn-dano" onClick={() => enviar('dano')}>
          {BOTOES[recurso].dano}
        </button>
        <button type="button" class="btn btn-cura" onClick={() => enviar('cura')}>
          {BOTOES[recurso].cura}
        </button>
      </div>
      {onExtra && (
        <div class="campo-extra">
          <label>
            <span>
              Extra<span class="sr-only"> de {nome}</span>
            </span>
            <Entrada
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              valor={String(extra)}
              onConfirmar={(t) => {
                const v = t.trim() === '' ? 0 : Number(t);
                if (!Number.isFinite(v) || v < 0) {
                  setErro('O extra precisa ser um número maior ou igual a zero');
                  return false;
                }
                setErro('');
                onExtra(v);
              }}
            />
          </label>
          <small>sai primeiro daqui no dano</small>
        </div>
      )}
      {erro && (
        <p class="erro" role="alert">
          {erro}
        </p>
      )}
    </section>
  );
}
