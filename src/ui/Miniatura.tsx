import { useEffect, useState } from 'preact/hooks';
import type { RepositorioFichas } from '../dados/repositorio';

/** Foto do item, carregada sob demanda (a lista do inventário não traz as imagens). */
export function Miniatura({
  repo,
  imagemId,
  alt,
  classe = 'miniatura',
}: {
  repo: RepositorioFichas;
  imagemId?: string;
  alt: string;
  classe?: string;
}) {
  const [src, setSrc] = useState<string>();
  useEffect(() => {
    let vivo = true;
    setSrc(undefined);
    if (imagemId) void repo.obterImagem(imagemId).then((img) => vivo && setSrc(img?.dataUrl));
    return () => {
      vivo = false;
    };
  }, [repo, imagemId]);

  if (!src) return <div class={`${classe} miniatura-vazia`} aria-hidden="true" />;
  return <img class={classe} src={src} alt={alt} />;
}
