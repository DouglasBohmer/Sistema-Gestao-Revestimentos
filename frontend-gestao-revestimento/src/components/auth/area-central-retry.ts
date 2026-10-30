type ExtensionCancelResult = { ok: boolean; code?: string }

// A concessão recusada já foi consumida. Limpar os dois lados antes de emitir outra.
export async function resetAreaCentralTransfer(
  cancelOnServer: () => Promise<unknown>,
  cancelInExtension: () => Promise<ExtensionCancelResult>,
): Promise<void> {
  await cancelOnServer()
  const result = await cancelInExtension()
  if (!result.ok && result.code !== 'NO_TRANSFER') {
    throw new Error('Não foi possível reiniciar a conexão com a extensão.')
  }
}
