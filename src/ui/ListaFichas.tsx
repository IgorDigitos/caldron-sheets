import { useEffect, useState } from 'preact/hooks';
import { criarFicha } from '../dominio/ficha';
import { importarFicha, lerArquivo } from '../dados/exportacao';
import type { RepositorioFichas, ResumoFicha } from '../dados/repositorio';
import { SKAR } from '../rules/fixtures/skar';

interface Props {
  repo: RepositorioFichas;
  navegar: (rota: string) => void;
}

export function ListaFichas({ repo, navegar }: Props) {
  const [fichas, setFichas] = useState<ResumoFicha[] | null>(null);
  const [erro, setErro] = useState('');

  // Nenhum botão falha em silêncio: qualquer erro aparece na tela.
  const tentar = async (acao: string, fn: () => Promise<void>) => {
    try {
      setErro('');
      await fn();
    } catch (e) {
      setErro(`Não foi possível ${acao}: ${(e as Error).message}`);
    }
  };

  const carregar = () => tentar('carregar as fichas', async () => setFichas(await repo.listar()));
  useEffect(() => {
    void carregar();
  }, [repo]);

  const criar = (dados: Parameters<typeof criarFicha>[0]) =>
    tentar('criar a ficha', async () => {
      const f = criarFicha(dados);
      await repo.salvar(f);
      navegar(`/ficha/${f.id}`);
    });

  const importar = (e: Event) => {
    const input = e.currentTarget as HTMLInputElement;
    const arquivo = input.files?.[0];
    input.value = '';
    if (!arquivo) return;
    return tentar('importar o backup', async () => {
      const dados = lerArquivo(await arquivo.text());
      const existente = await repo.obter(dados.ficha.id);
      if (
        existente &&
        !confirm(`A ficha de ${existente.nome} já existe neste aparelho. Substituir pelo backup? Isso não pode ser desfeito.`)
      ) {
        return;
      }
      navegar(`/ficha/${await importarFicha(repo, dados)}`);
    });
  };

  const excluir = (f: ResumoFicha) =>
    tentar('excluir a ficha', async () => {
      if (!confirm(`Excluir a ficha de ${f.nome}? Isso não pode ser desfeito.`)) return;
      await repo.excluir(f.id);
      setFichas(await repo.listar());
    });

  return (
    <main class="pagina home">
      <h1>Caldron Sheets</h1>
      <p class="subtitle">Ficha · Inventário · Journal</p>

      {erro && (
        <p class="erro" role="alert">
          {erro}
        </p>
      )}

      {fichas === null ? (
        <p class="carregando">Carregando…</p>
      ) : fichas.length === 0 ? (
        <p class="vazio">Nenhuma ficha ainda.</p>
      ) : (
        <ul class="lista-fichas">
          {fichas.map((f) => (
            <li key={f.id}>
              <a href={`#/ficha/${f.id}`} class="cartao-ficha">
                <strong>{f.nome}</strong>
                <span>{[f.raca, f.classe, `Nível ${f.nivel}`].filter(Boolean).join(' · ')}</span>
              </a>
              <button
                type="button"
                class="btn-icone"
                aria-label={`Excluir ${f.nome}`}
                onClick={() => void excluir(f)}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <div class="acoes-lista">
        <button type="button" class="btn btn-primario" onClick={() => void criar({ nome: 'Novo personagem' })}>
          Nova ficha
        </button>
        <button
          type="button"
          class="btn btn-secundario"
          onClick={() =>
            void criar({ nome: 'Skar Lionet', raca: 'Humano', classe: 'Pugilista', ...SKAR })
          }
        >
          Criar Skar de exemplo
        </button>
        <label class="btn btn-secundario botao-arquivo">
          Importar backup (JSON)
          <input
            type="file"
            accept="application/json,.json"
            class="sr-only"
            onChange={(e) => void importar(e)}
            aria-label="Importar backup (JSON)"
          />
        </label>
      </div>
    </main>
  );
}
