import {
  selectedFile,
  readSelectedSessionResult,
  fileMessage,
  FILE_ACTIVITY_KEY,
} from "./shared-file.js";
const status = document.getElementById("status"),
  selection = document.getElementById("selection");
let selectedHandle;
async function describe() {
  selectedHandle = await selectedFile().catch(() => null);
  const permission = selectedHandle
    ? await selectedHandle
        .queryPermission({ mode: "readwrite" })
        .catch(() => "prompt")
    : null;
  selection.textContent = selectedHandle
    ? permission === "granted"
      ? "Arquivo vinculado com leitura e escrita autorizadas. O caminho e os cookies não são exibidos."
      : fileMessage("FILE_PERMISSION_REQUIRED")
    : "Nenhum arquivo configurado. Será usado login individual.";
}
async function showActivity() {
  const keys = ["read", "write"].map(
    (operation) => `${FILE_ACTIVITY_KEY}.${operation}`,
  );
  const data = await chrome.storage.local.get(keys).catch(() => ({}));
  for (const operation of ["read", "write"]) {
    const activity = data[`${FILE_ACTIVITY_KEY}.${operation}`];
    const time = Date.parse(activity?.at);
    document.getElementById(`last-${operation}`).textContent =
      activity && Number.isFinite(time)
        ? `${new Date(time).toLocaleString("pt-BR")}: ${fileMessage(activity.code)}`
        : operation === "write"
          ? "Nenhuma gravação confirmada nesta extensão. Selecionar o arquivo, sozinho, não salva uma sessão."
          : "Nenhuma tentativa de leitura registrada nesta extensão.";
  }
}
async function resetActivity() {
  await chrome.storage.local.remove(
    ["read", "write"].map((operation) => `${FILE_ACTIVITY_KEY}.${operation}`),
  );
  await showActivity();
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
    selectedHandle = handle;
    await resetActivity();
    status.textContent =
      "Arquivo vinculado, mas a sessão ainda não foi salva. Volte ao RedeASSO e inicie Entrar com Área Central. Mantenha esta guia aberta até aparecer a confirmação da gravação.";
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
    // Usar o handle já carregado: o prompt precisa ocorrer diretamente no clique.
    const handle = selectedHandle;
    status.textContent =
      handle &&
      (await handle.requestPermission({ mode: "readwrite" })) === "granted"
        ? "Permissão renovada."
        : "Selecione um arquivo para autorizar o acesso.";
    await describe();
  } catch {
    status.textContent =
      "Não foi possível renovar; selecione o arquivo novamente.";
  }
});
document.getElementById("forget").addEventListener("click", async () => {
  await selectedFile(null);
  await resetActivity();
  status.textContent = "Arquivo desvinculado, sem apagar dados.";
  await describe();
});
document.getElementById("check").addEventListener("click", async () => {
  status.textContent = "Verificando o arquivo, sem mostrar seu conteúdo...";
  let timeout;
  const result = await Promise.race([
    readSelectedSessionResult(),
    new Promise((resolve) => {
      timeout = setTimeout(() => resolve({ code: "FILE_UNAVAILABLE" }), 3000);
    }),
  ]).finally(() => clearTimeout(timeout));
  // Mostrar apenas o diagnóstico de allowlist, nunca result.cookies.
  status.textContent = fileMessage(result.code);
  await describe();
});
chrome.storage.onChanged.addListener((_changes, area) => {
  if (area === "local") void showActivity();
});
void describe();
void showActivity();
