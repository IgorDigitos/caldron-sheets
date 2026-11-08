// Botão do descanso curto. Manda uma rolagem por recurso para a Mesa (o bot rola e posta no
// Discord) e, quando o resultado volta, soma no recurso da ficha. Se a pessoa sair da tela antes,
// o resultado é aplicado na próxima vez que ela abrir a ficha (até JANELA depois do pedido).

import { useEffect, useState } from 'preact/hooks';
import type { RepositorioMesa } from '../dados/mesa';
import { NOMES_RECURSOS, type Ficha } from '../dominio/ficha';
import { aplicarDescansoCurto, dadosDescansoCurto, expressao, textoRolagem } from '../dominio/descansoCurto';
import { criarMensagem, type Mensagem } from '../dominio/mesa';
import { useSessao } from './papel';

/** Pedido mais velho que isto não é mais aplicado (o bot já expira em 5 minutos). */
export const JANELA_DESCANSO_CURTO = 15 * 60 * 1000;

function semRede(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

interface Props {
  ficha: Ficha;
  mesa?: RepositorioMesa;
  salvar: (f: Ficha) => Promise<void>;
}

export function DescansoCurto({ ficha, mesa, salvar }: Props) {
  const { uid } = useSessao();
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [enviados, setEnviados] = useState<string[]>([]);
  const [aviso, setAviso] = useState('');

  useEffect(() => {
    if (!mesa) return undefined;
    return mesa.observar('mesa', setMensagens, () => setAviso('Não foi possível acompanhar a Mesa.'));
  }, [mesa]);

  const minhas = mensagens.filter(
    (m) => m.descanso && m.fichaId === ficha.id && m.autorUid === uid && m.criadoEm > Date.now() - JANELA_DESCANSO_CURTO,
  );

  // Resultado do bot chegou: soma no recurso. O id da rolagem vai no histórico, então rodar de novo
  // (outro redesenho, outro aparelho) não soma duas vezes.
  useEffect(() => {
    let nova = ficha;
    for (const m of [...minhas].reverse()) {
      const total = m.totais?.[0];
      if (m.estado !== 'feita' || typeof total !== 'number' || !m.descanso) continue;
      nova = aplicarDescansoCurto(nova, m.descanso, total, m.id, m.texto.split(' ')[0] ?? '');
    }
    if (nova !== ficha) void salvar(nova);
  });

  const dados = dadosDescansoCurto(ficha);
  const doEnvio = enviados.map((id) => minhas.find((m) => m.id === id));
  const aguardando = doEnvio.some((m) => !m || m.estado === 'pendente' || m.estado === 'rolando');
  const erros = doEnvio.flatMap((m) =>
    m && (m.estado === 'erro' || m.estado === 'expirada') && m.descanso
      ? [`${NOMES_RECURSOS[m.descanso]}: ${m.erro ?? 'não foi rolada.'}`]
      : [],
  );

  const descansar = async () => {
    if (!mesa || !uid) return;
    if (semRede()) return setAviso('Sem internet: o descanso curto precisa do bot para rolar.');
    setAviso('');
    try {
      const ids: string[] = [];
      for (const d of dados) {
        const m = criarMensagem({
          texto: textoRolagem(d),
          autorUid: uid,
          nome: ficha.nome,
          fichaId: ficha.id,
          descanso: d.recurso,
        });
        await mesa.enviar('mesa', m);
        ids.push(m.id);
      }
      setEnviados(ids);
    } catch (e) {
      setAviso(`Não foi possível pedir a rolagem: ${(e as Error).message}`);
    }
  };

  const motivo = !mesa
    ? 'O descanso curto precisa da nuvem (o bot rola os dados).'
    : !uid
      ? 'Entre com sua conta para rolar.'
      : dados.length === 0
        ? 'Vida, Stamina e Mana já estão cheias.'
        : undefined;
  const resumo = dados.map((d) => `${expressao(d)} ${NOMES_RECURSOS[d.recurso]}`).join(', ');

  return (
    <div class="descanso-curto">
      <button
        type="button"
        class="btn btn-secundario"
        disabled={!!motivo || aguardando}
        title={motivo ?? resumo}
        onClick={() => void descansar()}
      >
        Descanso curto
      </button>
      <p class="dica" aria-live="polite">
        {aguardando ? 'Descanso curto: aguardando o bot…' : (motivo ?? `Rola ${resumo}.`)}
      </p>
      {(aviso || erros.length > 0) && (
        <p class="erro" role="alert">
          {[aviso, ...erros].filter(Boolean).join(' ')}
        </p>
      )}
    </div>
  );
}
