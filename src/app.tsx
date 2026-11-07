import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import type { EstadoSync } from './dados/firestore';
import type { RepositorioFichas } from './dados/repositorio';
import type { Aba } from './ui/comum';
import { FichaTela } from './ui/FichaTela';
import { InventarioTela } from './ui/InventarioTela';
import { JournalTela } from './ui/JournalTela';
import { ListaFichas } from './ui/ListaFichas';

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

export function rotaParaTela(rota: string): { tela: 'lista' } | { tela: Aba; id: string } {
  const m = /^\/ficha\/([\w-]+)(?:\/(inventario|journal))?$/.exec(rota);
  if (!m) return { tela: 'lista' };
  return { tela: (m[2] as Aba | undefined) ?? 'ficha', id: m[1]! };
}

interface PropsApp {
  repo: RepositorioFichas;
  /** Estado da sincronização com a nuvem (ausente = só local). */
  sync?: EstadoSync;
  onLimparErroSync?: () => void;
  usuario?: string;
  onSair?: () => void;
  /** Aparece no topo da lista de fichas (ex.: migração das fichas locais). */
  avisoLista?: ComponentChildren;
}

function textoStatus(online: boolean, sync?: EstadoSync): string {
  const n = sync?.pendentes ?? 0;
  if (!online) return n > 0 ? `Offline · ${n} pendente${n > 1 ? 's' : ''}` : 'Offline — tudo continua funcionando';
  if (!sync) return 'Online';
  return n > 0 ? 'Sincronizando…' : 'Sincronizado';
}

export function App({ repo, sync, onLimparErroSync, usuario, onSair, avisoLista }: PropsApp) {
  const online = useOnline();
  const [rota, navegar] = useRota();
  const r = rotaParaTela(rota);

  return (
    <>
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
      {r.tela === 'ficha' && <FichaTela key={r.id} repo={repo} id={r.id} />}
      {r.tela === 'inventario' && <InventarioTela key={r.id} repo={repo} id={r.id} />}
      {r.tela === 'journal' && <JournalTela key={r.id} repo={repo} id={r.id} />}
    </>
  );
}
