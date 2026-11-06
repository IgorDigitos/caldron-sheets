import { useEffect, useState } from 'preact/hooks';
import type { RepositorioFichas } from './dados/repositorio';
import { FichaTela } from './ui/FichaTela';
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
    const mudou = () => setRota(rotaAtual());
    window.addEventListener('hashchange', mudou);
    return () => window.removeEventListener('hashchange', mudou);
  }, []);
  return [rota, (r) => (location.hash = r)];
}

export function App({ repo }: { repo: RepositorioFichas }) {
  const online = useOnline();
  const [rota, navegar] = useRota();
  const ficha = /^\/ficha\/([\w-]+)$/.exec(rota);

  return (
    <>
      <p class="status" data-testid="status" data-online={online}>
        {online ? 'Online' : 'Offline — tudo continua funcionando'}
      </p>
      {ficha ? <FichaTela key={ficha[1]} repo={repo} id={ficha[1]!} /> : <ListaFichas repo={repo} navegar={navegar} />}
    </>
  );
}
