import { useEffect, useState } from 'preact/hooks';

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

export function App() {
  const online = useOnline();
  return (
    <main class="home">
      <h1>Caldron Sheets</h1>
      <p class="subtitle">Ficha · Inventário · Journal</p>
      <p class="status" data-testid="status" data-online={online}>
        {online ? 'Online' : 'Offline — tudo continua funcionando'}
      </p>
    </main>
  );
}
