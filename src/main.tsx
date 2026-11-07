import { render } from 'preact';
import { registerSW } from 'virtual:pwa-register';
import { RepositorioDexie } from './dados/dexie';
import { USAR_EMULADOR } from './nuvem/config';
import { iniciarNuvem } from './nuvem/firebase';
import { pedirArmazenamentoPersistente } from './plataforma/armazenamento';
import { Sessao } from './ui/Sessao';
import './styles.css';

registerSW({ immediate: true });
void pedirArmazenamentoPersistente();

const nuvem = iniciarNuvem({ emulador: USAR_EMULADOR, persistente: true });

// O banco local das etapas 2–3 continua existindo só para migrar as fichas antigas para a nuvem.
render(<Sessao nuvem={nuvem} repoLocal={new RepositorioDexie()} />, document.getElementById('app')!);
