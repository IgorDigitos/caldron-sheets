// O navegador guarda o login POR ENDEREÇO. O mesmo site no domínio padrão do Firebase
// (caldron-sheets.firebaseapp.com) teria um login separado e pareceria "deslogar" a pessoa.
// Por isso esse endereço manda para o oficial. Links de prévia dos PRs não são redirecionados
// (servem para testar a versão nova).

export const ENDERECO_OFICIAL = 'https://caldron-sheets.web.app';
const DOMINIOS_ANTIGOS = new Set(['caldron-sheets.firebaseapp.com']);

/** Para onde ir, ou `null` se já está no lugar certo. Mantém caminho, busca e rota (#/ficha/…). */
export function redirecionamento(url: string): string | null {
  const u = new URL(url);
  if (!DOMINIOS_ANTIGOS.has(u.hostname)) return null;
  return `${ENDERECO_OFICIAL}${u.pathname}${u.search}${u.hash}`;
}
