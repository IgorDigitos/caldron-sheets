import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { App } from '../app';
import { RepositorioFirestore, type EstadoSync } from '../dados/firestore';
import type { RepositorioFichas } from '../dados/repositorio';
import {
  criarContaMestre,
  entrar,
  ErroConta,
  lerMestreUid,
  mensagemErro,
  sair,
  usuarioDoEmail,
} from '../nuvem/conta';
import type { Nuvem } from '../nuvem/firebase';
import { marcarMigracaoResolvida, migracaoResolvida, migrar } from '../nuvem/migracao';

type Estado =
  | { tipo: 'carregando' }
  | { tipo: 'deslogado'; temMestre: boolean | null }
  | { tipo: 'sem-acesso'; usuario: User }
  | { tipo: 'mestre'; usuario: User };

interface Props {
  nuvem: Nuvem;
  /** Fichas que estavam só neste aparelho (Dexie). */
  repoLocal?: RepositorioFichas;
}

export function Sessao({ nuvem, repoLocal }: Props) {
  const [estado, setEstado] = useState<Estado>({ tipo: 'carregando' });

  const rodada = useRef(0);
  const avaliar = useCallback(
    async (usuario: User | null) => {
      const minha = ++rodada.current;
      let mestreUid: string | null = null;
      let soube = true;
      try {
        mestreUid = await lerMestreUid(nuvem.db);
      } catch {
        soube = false; // sem rede e sem cache
      }
      if (minha !== rodada.current) return; // chegou uma avaliação mais nova
      if (!usuario) {
        setEstado({ tipo: 'deslogado', temMestre: soube ? mestreUid !== null : null });
        return;
      }
      setEstado(mestreUid === usuario.uid ? { tipo: 'mestre', usuario } : { tipo: 'sem-acesso', usuario });
    },
    [nuvem],
  );

  useEffect(() => onAuthStateChanged(nuvem.auth, (u) => void avaliar(u)), [nuvem, avaliar]);

  if (estado.tipo === 'carregando') return <p class="carregando pagina">Carregando…</p>;
  if (estado.tipo === 'deslogado') {
    return <TelaLogin nuvem={nuvem} temMestre={estado.temMestre} aoEntrar={() => void avaliar(nuvem.auth.currentUser)} />;
  }
  if (estado.tipo === 'sem-acesso') {
    return (
      <main class="pagina home">
        <h1>Caldron Sheets</h1>
        <p>
          A conta <strong>{usuarioDoEmail(estado.usuario.email)}</strong> ainda não tem acesso. Contas de jogador chegam
          na próxima etapa.
        </p>
        <button type="button" class="btn" onClick={() => void sair(nuvem.auth)}>
          Sair
        </button>
      </main>
    );
  }
  return <AreaMestre nuvem={nuvem} usuario={estado.usuario} repoLocal={repoLocal} />;
}

function AreaMestre({ nuvem, usuario, repoLocal }: { nuvem: Nuvem; usuario: User; repoLocal?: RepositorioFichas }) {
  const repo = useMemo(() => new RepositorioFirestore(nuvem.db, mensagemSync), [nuvem]);
  const [sync, setSync] = useState<EstadoSync>({ pendentes: 0 });
  useEffect(() => repo.observar(setSync), [repo]);

  return (
    <App
      repo={repo}
      sync={sync}
      onLimparErroSync={() => repo.limparErro()}
      usuario={usuarioDoEmail(usuario.email)}
      onSair={() => void sair(nuvem.auth)}
      avisoLista={repoLocal && <AvisoMigracao uid={usuario.uid} origem={repoLocal} destino={repo} />}
    />
  );
}

/**
 * Para o Mestre, "permission-denied" numa escrita quase sempre é a regra "última edição ganha":
 * este aparelho voltou da rede com uma alteração mais velha que a do servidor.
 */
export function mensagemSync(e: unknown): string {
  if ((e as { code?: string })?.code === 'permission-denied') {
    return 'Uma alteração feita aqui foi descartada porque outro aparelho fez uma edição mais nova. Abra a ficha de novo para ver a versão atual.';
  }
  return `Erro ao sincronizar: ${mensagemErro(e)}`;
}

/** "Este aparelho tem N fichas salvas só aqui" → enviar para a nuvem. */
export function AvisoMigracao({
  uid,
  origem,
  destino,
  aoTerminar,
}: {
  uid: string;
  origem: RepositorioFichas;
  destino: RepositorioFichas;
  aoTerminar?: () => void;
}) {
  const [qtd, setQtd] = useState(0);
  const [situacao, setSituacao] = useState<'pergunta' | 'enviando' | 'feito'>('pergunta');
  const [mensagem, setMensagem] = useState('');

  useEffect(() => {
    if (migracaoResolvida(uid)) return;
    origem
      .listar()
      .then((l) => setQtd(l.length))
      .catch(() => {});
  }, [uid, origem]);

  if (qtd === 0 && situacao === 'pergunta') return null;

  const enviar = async () => {
    setSituacao('enviando');
    try {
      const r = await migrar(origem, destino);
      marcarMigracaoResolvida(uid);
      setMensagem(
        `${r.enviadas} ficha(s) enviada(s) para a nuvem` +
          (r.ignoradas ? `; ${r.ignoradas} já estava(m) mais nova(s) lá` : '') +
          '. A cópia deste aparelho continua guardada.',
      );
      setSituacao('feito');
      aoTerminar?.();
    } catch (e) {
      setMensagem(`Não foi possível enviar: ${mensagemErro(e)}`);
      setSituacao('pergunta');
    }
  };

  return (
    <section class="aviso" role="region" aria-label="Fichas deste aparelho">
      {situacao === 'feito' ? (
        <p>{mensagem}</p>
      ) : (
        <>
          <p>
            Este aparelho tem <strong>{qtd}</strong> ficha(s) salva(s) só aqui, de antes da nuvem. Enviar para a sua
            conta?
          </p>
          {mensagem && (
            <p class="erro" role="alert">
              {mensagem}
            </p>
          )}
          <div class="form-acoes">
            <button type="button" class="btn btn-primario" disabled={situacao === 'enviando'} onClick={() => void enviar()}>
              {situacao === 'enviando' ? 'Enviando…' : 'Enviar para a nuvem'}
            </button>
            <button
              type="button"
              class="btn"
              disabled={situacao === 'enviando'}
              onClick={() => {
                marcarMigracaoResolvida(uid);
                setQtd(0);
              }}
            >
              Agora não
            </button>
          </div>
        </>
      )}
    </section>
  );
}

export function TelaLogin({
  nuvem,
  temMestre,
  aoEntrar,
}: {
  nuvem: Nuvem;
  temMestre: boolean | null;
  /** Chamado quando o login/cadastro terminou (o aviso do Firebase chega antes da campanha ser criada). */
  aoEntrar?: () => void;
}) {
  const [modo, setModo] = useState<'entrar' | 'mestre'>(temMestre === false ? 'mestre' : 'entrar');
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    if (temMestre === false) setModo('mestre');
  }, [temMestre]);

  const enviar = async (ev: Event) => {
    ev.preventDefault();
    setErro('');
    setOcupado(true);
    try {
      if (modo === 'mestre') {
        if (senha !== confirmar) throw new ErroConta('As senhas não são iguais');
        await criarContaMestre(nuvem.auth, nuvem.db, usuario, senha);
      } else {
        await entrar(nuvem.auth, usuario, senha);
      }
      aoEntrar?.();
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      setOcupado(false);
    }
  };

  return (
    <main class="pagina home login">
      <h1>Caldron Sheets</h1>
      <p class="subtitle">Ficha · Inventário · Journal</p>

      <form onSubmit={enviar} class="form-login" aria-label={modo === 'mestre' ? 'Criar conta de Mestre' : 'Entrar'}>
        {modo === 'mestre' && (
          <p class="aviso-texto">
            <strong>Primeiro acesso.</strong> Esta campanha ainda não tem Mestre: crie a sua conta. Só dá para fazer isso
            uma vez.
          </p>
        )}
        <label class="campo">
          <span>Usuário</span>
          <input
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            spellcheck={false}
            required
            value={usuario}
            onInput={(e) => setUsuario(e.currentTarget.value)}
          />
        </label>
        <label class="campo">
          <span>Senha</span>
          <input
            type="password"
            autoComplete={modo === 'mestre' ? 'new-password' : 'current-password'}
            required
            value={senha}
            onInput={(e) => setSenha(e.currentTarget.value)}
          />
        </label>
        {modo === 'mestre' && (
          <label class="campo">
            <span>Confirmar senha</span>
            <input
              type="password"
              autoComplete="new-password"
              required
              value={confirmar}
              onInput={(e) => setConfirmar(e.currentTarget.value)}
            />
          </label>
        )}
        {erro && (
          <p class="erro" role="alert">
            {erro}
          </p>
        )}
        <button type="submit" class="btn btn-primario" disabled={ocupado}>
          {ocupado ? 'Aguarde…' : modo === 'mestre' ? 'Criar conta de Mestre' : 'Entrar'}
        </button>
        {temMestre === false && modo === 'entrar' && (
          <button type="button" class="btn-link" onClick={() => setModo('mestre')}>
            Primeiro acesso: criar conta de Mestre
          </button>
        )}
        {modo === 'mestre' && (
          <button type="button" class="btn-link" onClick={() => setModo('entrar')}>
            Já tenho conta
          </button>
        )}
      </form>
    </main>
  );
}
