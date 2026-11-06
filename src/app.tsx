import { useEffect, useState } from 'preact/hooks';
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

export function App({ repo }: { repo: RepositorioFichas }) {
  const online = useOnline();
  const [rota, navegar] = useRota();
  const r = rotaParaTela(rota);

  return (
    <>
      <p class="status" data-testid="status" data-online={online}>
        {online ? 'Online' : 'Offline — tudo continua funcionando'}
      </p>
      {r.tela === 'lista' && <ListaFichas repo={repo} navegar={navegar} />}
      {r.tela === 'ficha' && <FichaTela key={r.id} repo={repo} id={r.id} />}
      {r.tela === 'inventario' && <InventarioTela key={r.id} repo={repo} id={r.id} />}
      {r.tela === 'journal' && <JournalTela key={r.id} repo={repo} id={r.id} />}
    </>
  );
}
