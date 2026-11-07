import { useState } from 'preact/hooks';
import { ErroConta, mensagemErro } from '../nuvem/conta';
import { useSessao } from './papel';

/** Tela do Mestre: criar contas de jogador e ver quem já existe. */
export function JogadoresTela() {
  const { jogadores, criarJogador } = useSessao();
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const enviar = async (ev: Event) => {
    ev.preventDefault();
    if (!criarJogador) return;
    setErro('');
    setAviso('');
    setOcupado(true);
    try {
      if (senha !== confirmar) throw new ErroConta('As senhas não são iguais');
      const conta = await criarJogador(usuario, senha);
      setAviso(`Conta "${conta.usuario}" criada. Passe o usuário e a senha para o jogador.`);
      setUsuario('');
      setSenha('');
      setConfirmar('');
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      setOcupado(false);
    }
  };

  return (
    <main class="pagina jogadores">
      <nav class="abas-ficha">
        <a href="#/" class="voltar">
          ← Fichas
        </a>
      </nav>
      <header class="cabecalho">
        <h1>Jogadores</h1>
        <p class="subtitulo">Crie a conta de cada jogador e depois escolha o dono de cada ficha em "Editar ficha".</p>
      </header>

      <section aria-label="Contas de jogador">
        <h2>Contas</h2>
        {jogadores.length === 0 ? (
          <p class="vazio">Nenhum jogador ainda.</p>
        ) : (
          <ul class="lista-jogadores">
            {jogadores.map((j) => (
              <li key={j.uid}>{j.usuario}</li>
            ))}
          </ul>
        )}
      </section>

      <form class="form-login" onSubmit={enviar} aria-label="Nova conta de jogador">
        <h2>Nova conta</h2>
        <label class="campo">
          <span>Usuário</span>
          <input
            type="text"
            autoComplete="off"
            autoCapitalize="none"
            spellcheck={false}
            required
            value={usuario}
            onInput={(e) => setUsuario(e.currentTarget.value)}
          />
        </label>
        <label class="campo">
          <span>Senha</span>
          <input type="password" autoComplete="new-password" required value={senha} onInput={(e) => setSenha(e.currentTarget.value)} />
        </label>
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
        {erro && (
          <p class="erro" role="alert">
            {erro}
          </p>
        )}
        {aviso && (
          <p class="aviso-texto" role="status">
            {aviso}
          </p>
        )}
        <button type="submit" class="btn btn-primario" disabled={ocupado || !criarJogador}>
          {ocupado ? 'Criando…' : 'Criar conta de jogador'}
        </button>
        <p class="vazio">
          Precisa de internet. Para trocar a senha de um jogador depois, use o console do Firebase (Authentication).
        </p>
      </form>
    </main>
  );
}
