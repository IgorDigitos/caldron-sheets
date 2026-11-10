// O app instalado costuma ficar dias aberto em segundo plano, e o navegador só procura versão nova do
// service worker quando a página abre do zero. Por isso o app procura de novo sempre que a pessoa
// VOLTA para ele (aba/app fica visível). Com `registerType: 'autoUpdate'`, achou versão nova = a
// página recarrega já na versão nova, logo que a pessoa volta, e não no meio do uso.

/** Intervalo mínimo entre duas procuras, para não pedir ao servidor a cada troca rápida de app. */
export const INTERVALO_MINIMO = 60 * 1000;

interface Documento {
  visibilityState: DocumentVisibilityState;
  addEventListener(tipo: 'visibilitychange', f: () => void): void;
  removeEventListener(tipo: 'visibilitychange', f: () => void): void;
}

/** Liga a procura ao voltar para o app. Devolve o "desligar". */
export function procurarAtualizacaoAoVoltar(
  registro: Pick<ServiceWorkerRegistration, 'update'>,
  doc: Documento = document,
  agora: () => number = Date.now,
): () => void {
  let ultima = agora();
  const aoMudar = () => {
    if (doc.visibilityState !== 'visible' || agora() - ultima < INTERVALO_MINIMO) return;
    ultima = agora();
    // Sem rede ou servidor fora: tenta de novo na próxima volta.
    registro.update().catch(() => {});
  };
  doc.addEventListener('visibilitychange', aoMudar);
  return () => doc.removeEventListener('visibilitychange', aoMudar);
}
