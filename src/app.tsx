import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import type { EstadoSync } from './dados/firestore';
import type { RepositorioMesa } from './dados/mesa';
import type { RepositorioFichas } from './dados/repositorio';
import type { Aba } from './ui/comum';
import { BoardTela } from './ui/BoardTela';
import { FichaTela } from './ui/FichaTela';
import { InventarioTela } from './ui/InventarioTela';
import { JogadoresTela } from './ui/JogadoresTela';
import { JournalTela } from './ui/JournalTela';
import { ContextoSessao, SESSAO_PADRAO, type InfoSessao } from './ui/papel';
import { ListaFichas } from './ui/ListaFichas';
import { MesaTela } from './ui/MesaTela';
import { RecursosTela } from './ui/RecursosTela';
import { SkillsTela } from './ui/SkillsTela';

function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

function rotaAtual(): string {
  return location.hash.replace(/^#/, '') || '/';
}

function useRota(): [string, (r: string) => void] {
  const [rota, setRota] = useState(rotaAtual);
  useEffect(() => {
    const mudou = () => {
      setRota(rotaAtual());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', mudou);
    return () => window.removeEventListener('hashchange', mudou);
  }, []);
  return [rota, (r) => (location.hash = r)];
}

export function rotaParaTela(
  rota: string,
): { tela: 'lista' | 'jogadores' | 'recursos' | 'mesa-geral' | 'board' } | { tela: Aba; id: string } {
  if (rota === '/jogadores') return { tela: 'jogadores' };
  if (rota === '/board') return { tela: 'board' };
  if (rota === '/recursos') return { tela: 'recursos' };
  if (rota === '/mesa') return { tela: 'mesa-geral' };
  const m = /^\/ficha\/([\w-]+)(?:\/(inventario|skills|journal|mesa))?$/.exec(rota);
  if (!m) return { tela: 'lista' };
  return { tela: (m[2] as Aba | undefined) ?? 'ficha', id: m[1]! };
}

interface PropsApp {
  repo: RepositorioFichas;
  /** Chat e rolagens (só na nuvem). */
  mesa?: RepositorioMesa;
  /** Estado da sincronização com a nuvem (ausente = só local). */
  sync?: EstadoSync;
  onLimparErroSync?: () => void;
  usuario?: string;
  onSair?: () => void;
  /** Aparece no topo da lista de fichas (ex.: migração das fichas locais). */
  avisoLista?: ComponentChildren;
  /** Mestre ou Jogador. Sem isto, Mestre (modo local e testes). */
  sessao?: InfoSessao;
}

function textoStatus(online: boolean, sync?: EstadoSync): string {
  const n = sync?.pendentes ?? 0;
  if (!online) return n > 0 ? `Offline · ${n} pendente${n > 1 ? 's' : ''}` : 'Offline — tudo continua funcionando';
  if (!sync) return 'Online';
  return n > 0 ? 'Sincronizando…' : 'Sincronizado';
}

export function App({ repo, mesa, sync, onLimparErroSync, usuario, onSair, avisoLista, sessao = SESSAO_PADRAO }: PropsApp) {
  const online = useOnline();
  const [rota, navegar] = useRota();
  const r = rotaParaTela(rota);

  return (
    <ContextoSessao.Provider value={sessao}>
      {usuario && (
        <p class="conta">
          <span>{usuario}</span>
          {onSair && (
            <button type="button" class="btn-link" onClick={onSair}>
              Sair
            </button>
          )}
        </p>
      )}
      <p
        class="status"
        data-testid="status"
        data-online={online}
        data-sync={sync ? (sync.pendentes > 0 ? 'pendente' : 'ok') : undefined}
        data-gravando={sync ? String(sync.gravando ?? 0) : undefined}
      >
        {textoStatus(online, sync)}
      </p>
      {sync?.erro && (
        <div class="erro-sync" role="alert">
          <span>{sync.erro}</span>
          {onLimparErroSync && (
            <button type="button" class="btn-icone" aria-label="Fechar aviso" onClick={onLimparErroSync}>
              ✕
            </button>
          )}
        </div>
      )}
      {r.tela === 'lista' && <ListaFichas repo={repo} navegar={navegar} aviso={avisoLista} />}
      {r.tela === 'ficha' && <FichaTela key={r.id} repo={repo} id={r.id} mesa={mesa} />}
      {r.tela === 'inventario' && <InventarioTela key={r.id} repo={repo} id={r.id} />}
      {r.tela === 'skills' && <SkillsTela key={r.id} repo={repo} id={r.id} />}
      {r.tela === 'journal' && <JournalTela key={r.id} repo={repo} id={r.id} />}
      {r.tela === 'mesa' && <MesaTela key={r.id} repo={repo} mesa={mesa} fichaId={r.id} />}
      {r.tela === 'mesa-geral' && <MesaTela repo={repo} mesa={mesa} />}
      {r.tela === 'recursos' &&
        (sessao.papel === 'mestre' ? <RecursosTela repo={repo} /> : <ListaFichas repo={repo} navegar={navegar} />)}
      {r.tela === 'board' &&
        (sessao.papel === 'mestre' ? <BoardTela repo={repo} /> : <ListaFichas repo={repo} navegar={navegar} />)}
      {r.tela === 'jogadores' &&
        (sessao.papel === 'mestre' ? <JogadoresTela /> : <ListaFichas repo={repo} navegar={navegar} />)}
    </ContextoSessao.Provider>
  );
}
