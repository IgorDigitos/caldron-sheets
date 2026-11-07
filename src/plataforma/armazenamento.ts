// Pede ao navegador para não apagar os dados do app (IndexedDB: cache do Firebase e fichas antigas)
// quando o aparelho estiver com pouco espaço. No Android, app instalado costuma ganhar na hora.

export type ResultadoPersistencia = 'persistente' | 'negado' | 'indisponivel';

export async function pedirArmazenamentoPersistente(
  storage: Pick<StorageManager, 'persist' | 'persisted'> | undefined = globalThis.navigator?.storage,
): Promise<ResultadoPersistencia> {
  if (!storage?.persist) return 'indisponivel';
  try {
    if (await storage.persisted()) return 'persistente';
    return (await storage.persist()) ? 'persistente' : 'negado';
  } catch {
    return 'indisponivel';
  }
}
