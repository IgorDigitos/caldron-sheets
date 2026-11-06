// Foto de item: redimensiona para no máximo 400px de lado e comprime em WebP até ~150KB.
// Guardada como data URL (base64) em documento separado do item — é o formato que a etapa 4
// manda para o Firestore (limite de 1MB por documento).

import { novoId } from '../dominio/id';

export const LADO_MAXIMO = 400;
export const BYTES_MAXIMO = 150 * 1024;
const QUALIDADES = [0.85, 0.75, 0.62, 0.5, 0.38, 0.28];
const MENOR_LADO_TENTADO = 120;

export interface Imagem {
  id: string;
  fichaId: string;
  dataUrl: string;
  tipo: string;
  largura: number;
  altura: number;
  bytes: number;
  criadoEm: number;
}

export class ImagemInvalida extends Error {}

/** Cabe dentro de lado×lado mantendo a proporção; nunca aumenta a imagem. */
export function dimensoesAlvo(largura: number, altura: number, lado = LADO_MAXIMO): { largura: number; altura: number } {
  if (largura <= 0 || altura <= 0) throw new ImagemInvalida('Imagem sem tamanho');
  const escala = Math.min(1, lado / Math.max(largura, altura));
  return {
    largura: Math.max(1, Math.round(largura * escala)),
    altura: Math.max(1, Math.round(altura * escala)),
  };
}

/** Desenha a imagem em largura×altura e codifica com a qualidade pedida. */
export type Codificador = (largura: number, altura: number, qualidade: number) => Promise<Blob>;

/**
 * Tenta qualidades decrescentes; se nem a menor couber em `bytesMaximo`, reduz o lado e tenta de
 * novo. Devolve o primeiro resultado que cabe.
 */
export async function escolherCompressao(
  original: { largura: number; altura: number },
  codificar: Codificador,
  bytesMaximo = BYTES_MAXIMO,
): Promise<{ blob: Blob; largura: number; altura: number }> {
  let lado = LADO_MAXIMO;
  while (lado >= MENOR_LADO_TENTADO) {
    const { largura, altura } = dimensoesAlvo(original.largura, original.altura, lado);
    for (const q of QUALIDADES) {
      const blob = await codificar(largura, altura, q);
      if (blob.size <= bytesMaximo) return { blob, largura, altura };
    }
    lado = Math.floor(lado * 0.75);
  }
  throw new ImagemInvalida('Não foi possível deixar a imagem pequena o bastante');
}

function blobParaDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(leitor.result as string);
    leitor.onerror = () => reject(leitor.error);
    leitor.readAsDataURL(blob);
  });
}

/* v8 ignore start -- depende de canvas/createImageBitmap reais; coberto pelo E2E no Chromium */
async function abrirImagem(arquivo: Blob): Promise<ImageBitmap> {
  if (!arquivo.type.startsWith('image/')) throw new ImagemInvalida('O arquivo não é uma imagem');
  try {
    return await createImageBitmap(arquivo, { imageOrientation: 'from-image' });
  } catch {
    throw new ImagemInvalida('Não foi possível abrir a imagem');
  }
}

function codificadorCanvas(bitmap: ImageBitmap): Codificador {
  const canvas = document.createElement('canvas');
  return (largura, altura, qualidade) => {
    canvas.width = largura;
    canvas.height = altura;
    const ctx = canvas.getContext('2d');
    if (!ctx) return Promise.reject(new ImagemInvalida('Canvas indisponível'));
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, largura, altura);
    return new Promise((resolve, reject) =>
      canvas.toBlob(
        // Navegador sem WebP devolve PNG; nesse caso caímos para JPEG, que comprime.
        (b) => {
          if (!b) return reject(new ImagemInvalida('Falha ao comprimir a imagem'));
          if (b.type === 'image/webp') return resolve(b);
          canvas.toBlob((j) => (j ? resolve(j) : reject(new ImagemInvalida('Falha ao comprimir'))), 'image/jpeg', qualidade);
        },
        'image/webp',
        qualidade,
      ),
    );
  };
}

/** Lê o arquivo da câmera/galeria e devolve a imagem pronta para salvar. */
export async function prepararImagem(arquivo: Blob, fichaId: string, agora = Date.now()): Promise<Imagem> {
  const bitmap = await abrirImagem(arquivo);
  try {
    const r = await escolherCompressao({ largura: bitmap.width, altura: bitmap.height }, codificadorCanvas(bitmap));
    return {
      id: novoId(),
      fichaId,
      dataUrl: await blobParaDataUrl(r.blob),
      tipo: r.blob.type,
      largura: r.largura,
      altura: r.altura,
      bytes: r.blob.size,
      criadoEm: agora,
    };
  } finally {
    bitmap.close();
  }
}
/* v8 ignore stop */
