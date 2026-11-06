import { useState } from 'preact/hooks';
import { criarItem, editarItem, type Item } from '../dominio/inventario';
import type { RepositorioFichas } from '../dados/repositorio';
import { prepararImagem as prepararPadrao, type Imagem } from '../midia/imagem';
import { formatar } from '../rules/motor';
import { lerNumero } from './comum';
import { Miniatura } from './Miniatura';

interface Props {
  repo: RepositorioFichas;
  fichaId: string;
  /** Item sendo editado; ausente = item novo. */
  item?: Item;
  onSalvo: (item: Item) => void;
  onExcluido: (id: string) => void;
  onCancelar: () => void;
  /** Injetável para testes (jsdom não tem canvas). */
  prepararImagem?: typeof prepararPadrao;
}

type Foto = { tipo: 'manter' } | { tipo: 'nova'; imagem: Imagem } | { tipo: 'remover' };

export function FormItem({ repo, fichaId, item, onSalvo, onExcluido, onCancelar, prepararImagem = prepararPadrao }: Props) {
  const [campos, setCampos] = useState({
    nome: item?.nome ?? '',
    qtd: String(item?.qtd ?? 1),
    peso: String(item?.peso ?? 0),
    defF: String(item?.defF ?? 0),
    defM: String(item?.defM ?? 0),
    descricao: item?.descricao ?? '',
  });
  const [foto, setFoto] = useState<Foto>({ tipo: 'manter' });
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState('');

  const campo = (nome: keyof typeof campos) => ({
    value: campos[nome],
    onInput: (e: Event) => setCampos({ ...campos, [nome]: (e.currentTarget as HTMLInputElement).value }),
  });

  const escolherFoto = async (e: Event) => {
    const input = e.currentTarget as HTMLInputElement;
    const arquivo = input.files?.[0];
    input.value = '';
    if (!arquivo) return;
    setProcessando(true);
    setErro('');
    try {
      setFoto({ tipo: 'nova', imagem: await prepararImagem(arquivo, fichaId) });
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setProcessando(false);
    }
  };

  const salvar = async (e: Event) => {
    e.preventDefault();
    try {
      const imagemAntiga = item?.imagemId;
      let imagemId = imagemAntiga;
      if (foto.tipo === 'nova') imagemId = foto.imagem.id;
      if (foto.tipo === 'remover') imagemId = undefined;
      const dados = {
        nome: campos.nome,
        qtd: lerNumero(campos.qtd),
        peso: lerNumero(campos.peso),
        defF: lerNumero(campos.defF),
        defM: lerNumero(campos.defM),
        descricao: campos.descricao,
        imagemId,
      };
      const salvo = item ? editarItem(item, dados) : criarItem(fichaId, dados);
      if (foto.tipo === 'nova') await repo.salvarImagem(foto.imagem);
      await repo.salvarItem(salvo);
      if (imagemAntiga && imagemAntiga !== salvo.imagemId) await repo.excluirImagem(imagemAntiga);
      onSalvo(salvo);
    } catch (err) {
      setErro((err as Error).message);
    }
  };

  const excluir = async () => {
    if (!item || !confirm(`Excluir ${item.nome}?`)) return;
    try {
      await repo.excluirItem(item.id);
      if (item.imagemId) await repo.excluirImagem(item.imagemId);
      onExcluido(item.id);
    } catch (err) {
      setErro((err as Error).message);
    }
  };

  const temFoto = foto.tipo === 'nova' || (foto.tipo === 'manter' && !!item?.imagemId);

  return (
    <form class="form-item" onSubmit={salvar} aria-label={item ? `Editar ${item.nome}` : 'Novo item'}>
      <h2>{item ? 'Editar item' : 'Novo item'}</h2>

      <div class="foto-item">
        {foto.tipo === 'nova' ? (
          <img class="miniatura grande" src={foto.imagem.dataUrl} alt="Foto do item" />
        ) : foto.tipo === 'manter' && item?.imagemId ? (
          <Miniatura repo={repo} imagemId={item.imagemId} alt="Foto do item" />
        ) : (
          <div class="miniatura grande miniatura-vazia" aria-hidden="true" />
        )}
        <div class="foto-acoes">
          <label class="btn">
            Tirar foto
            <input type="file" accept="image/*" capture="environment" class="sr-only" onChange={escolherFoto} />
          </label>
          <label class="btn">
            Galeria
            <input
              type="file"
              accept="image/*"
              class="sr-only"
              onChange={escolherFoto}
              aria-label="Escolher foto da galeria"
            />
          </label>
          {temFoto && (
            <button type="button" class="btn" onClick={() => setFoto({ tipo: 'remover' })}>
              Remover foto
            </button>
          )}
        </div>
        {processando && <p class="vazio">Comprimindo foto…</p>}
        {foto.tipo === 'nova' && (
          <p class="vazio" data-testid="info-foto">
            {foto.imagem.largura}×{foto.imagem.altura} · {formatar(foto.imagem.bytes / 1024)} KB
          </p>
        )}
      </div>

      <label class="campo">
        <span>Nome</span>
        <input type="text" required {...campo('nome')} />
      </label>
      <div class="campos-texto">
        <label class="campo">
          <span>Quantidade</span>
          <input type="text" inputMode="decimal" {...campo('qtd')} />
        </label>
        <label class="campo">
          <span>Peso (unidade)</span>
          <input type="text" inputMode="decimal" {...campo('peso')} />
        </label>
        <label class="campo">
          <span>Def. Física</span>
          <input type="text" inputMode="decimal" {...campo('defF')} />
        </label>
        <label class="campo">
          <span>Def. Mágica</span>
          <input type="text" inputMode="decimal" {...campo('defM')} />
        </label>
      </div>
      <label class="campo">
        <span>Descrição</span>
        <textarea rows={3} {...campo('descricao')} />
      </label>

      {erro && (
        <p class="erro" role="alert">
          {erro}
        </p>
      )}

      <div class="form-acoes">
        <button type="submit" class="btn btn-primario" disabled={processando}>
          Salvar item
        </button>
        <button type="button" class="btn" onClick={onCancelar}>
          Cancelar
        </button>
        {item && (
          <button type="button" class="btn btn-dano" onClick={() => void excluir()}>
            Excluir
          </button>
        )}
      </div>
    </form>
  );
}
