import { selectedFile } from "./shared-file.js";
const status = document.getElementById("status"),
  selection = document.getElementById("selection");
async function describe() {
  const handle = await selectedFile().catch(() => null);
  selection.textContent = handle
    ? "Arquivo vinculado neste navegador. O caminho e os cookies não são exibidos."
    : "Nenhum arquivo configurado. Será usado login individual.";
}
const types = [
  {
    description: "Sessão da Área Central (.txt)",
    accept: { "text/plain": [".txt"] },
  },
];
async function choose(create) {
  try {
    // File picker deve ser chamado diretamente do clique, antes de operações assíncronas.
    const pending = create
      ? window.showSaveFilePicker({
          suggestedName: "redeasso-sessao.txt",
          types,
        })
      : window.showOpenFilePicker({ multiple: false, types });
    const result = await pending;
    const handle = create ? result : result[0];
    if (!handle.name.toLowerCase().endsWith(".txt")) throw new Error();
    if ((await handle.requestPermission({ mode: "readwrite" })) !== "granted")
      throw new Error();
    await selectedFile(handle);
    status.textContent =
      "Arquivo vinculado. Faça um login normal para salvar a sessão atual.";
    await describe();
  } catch {
    status.textContent =
      "Arquivo não vinculado. Seleção cancelada, permissão negada ou recurso indisponível. O login individual continua disponível.";
  }
}
document
  .getElementById("select")
  .addEventListener("click", () => void choose(false));
document
  .getElementById("create")
  .addEventListener("click", () => void choose(true));
document.getElementById("permission").addEventListener("click", async () => {
  try {
    const handle = await selectedFile();
    status.textContent =
      handle &&
      (await handle.requestPermission({ mode: "readwrite" })) === "granted"
        ? "Permissão renovada."
        : "Selecione um arquivo para autorizar o acesso.";
  } catch {
    status.textContent =
      "Não foi possível renovar; selecione o arquivo novamente.";
  }
});
document.getElementById("forget").addEventListener("click", async () => {
  await selectedFile(null);
  status.textContent = "Arquivo desvinculado, sem apagar dados.";
  await describe();
});
void describe();
