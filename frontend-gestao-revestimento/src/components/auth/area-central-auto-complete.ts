export async function autoCompleteAreaCentral(
  completeOnServer: () => Promise<boolean>,
  returnToApp: () => Promise<unknown>,
): Promise<void> {
  if (!(await completeOnServer()))
    throw new Error("O servidor não confirmou o acesso.");
  // Falha de foco/fechamento não desfaz a autenticação já confirmada pelo Spring.
  try {
    await returnToApp();
  } catch {
    /* A guia original pode ter sido fechada. */
  }
}
