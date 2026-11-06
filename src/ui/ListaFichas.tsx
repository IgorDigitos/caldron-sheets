import { useEffect, useState } from 'preact/hooks';
import { criarFicha } from '../dominio/ficha';
import type { RepositorioFichas, ResumoFicha } from '../dados/repositorio';
import { SKAR } from '../rules/fixtures/skar';

interface Props {
  repo: RepositorioFichas;
  navegar: (rota: string) => void;
}

export function ListaFichas({ repo, navegar }: Props) {
  const [fichas, setFichas] = useState<ResumoFicha[] | null>(null);

  const carregar = () => repo.listar().then(setFichas);
  useEffect(() => {
    void carregar();
  }, [repo]);

  const criar = async (dados: Parameters<typeof criarFicha>[0]) => {
    const f = criarFicha(dados);
    await repo.salvar(f);
    navegar(`/ficha/${f.id}`);
  };

  const excluir = async (f: ResumoFicha) => {
    if (!confirm(`Excluir a ficha de ${f.nome}? Isso não pode ser desfeito.`)) return;
    await repo.excluir(f.id);
    await carregar();
  };

  return (
    <main class="pagina home">
      <h1>Caldron Sheets</h1>
      <p class="subtitle">Ficha · Inventário · Journal</p>

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
      </div>
    </main>
  );
}
