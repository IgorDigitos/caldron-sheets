import { render } from 'preact';
import { registerSW } from 'virtual:pwa-register';
import { RepositorioDexie } from './dados/dexie';
import { USAR_EMULADOR } from './nuvem/config';
import { iniciarNuvem } from './nuvem/firebase';
import { pedirArmazenamentoPersistente } from './plataforma/armazenamento';
import { procurarAtualizacaoAoVoltar } from './plataforma/atualizacao';
import { redirecionamento } from './plataforma/endereco';
import { Sessao } from './ui/Sessao';
import './styles.css';

// Endereço antigo tem login separado: manda para o oficial antes de abrir qualquer coisa.
const destino = redirecionamento(location.href);
if (destino) {
  location.replace(destino);
} else {
  registerSW({
    immediate: true,
    // App instalado fica dias aberto: procura versão nova toda vez que a pessoa volta para ele.
    onRegisteredSW: (_url, registro) => {
      if (registro) procurarAtualizacaoAoVoltar(registro);
    },
  });
  void pedirArmazenamentoPersistente();

  const nuvem = iniciarNuvem({ emulador: USAR_EMULADOR, persistente: true });

  // O banco local das etapas 2–3 continua existindo só para migrar as fichas antigas para a nuvem.
  render(<Sessao nuvem={nuvem} repoLocal={new RepositorioDexie()} />, document.getElementById('app')!);
}
