/**
 * UUID v4. `crypto.randomUUID()` só existe em contexto seguro (HTTPS ou localhost); abrindo o
 * app pelo IP da rede (http://192.168.x.x) ele não existe, então montamos o UUID com
 * `getRandomValues`, que funciona em qualquer página.
 */
export function novoId(c: Pick<Crypto, 'getRandomValues'> & Partial<Pick<Crypto, 'randomUUID'>> = crypto): string {
  if (typeof c.randomUUID === 'function') return c.randomUUID();
  const b = c.getRandomValues(new Uint8Array(16));
  b[6] = (b[6]! & 0x0f) | 0x40; // versão 4
  b[8] = (b[8]! & 0x3f) | 0x80; // variante RFC 4122
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
