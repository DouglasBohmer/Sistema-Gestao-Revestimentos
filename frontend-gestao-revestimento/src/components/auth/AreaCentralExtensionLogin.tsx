import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ExternalLink,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";
import {
  ApiError,
  cancelAreaCentralBrowserTransfer,
  getCurrentAreaCentralBrowserTransfer,
  startAreaCentralBrowserTransfer,
  type AreaCentralBrowserTransferState,
} from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { areaCentralExtension } from "./area-central-extension";
import { resetAreaCentralTransfer } from "./area-central-retry";
import { autoCompleteAreaCentral } from "./area-central-auto-complete";

const INSTALL_GUIDE =
  "https://github.com/DouglasBohmer/Sistema-Gestao-Revestimentos/blob/main/docs/EXTENSAO_AREA_CENTRAL.md";
function errorMessage(cause: unknown) {
  if (cause instanceof ApiError && cause.status === 403)
    return "A sessão de segurança expirou. Atualize a página e tente novamente.";
  if (cause instanceof ApiError && cause.status === 404)
    return "A tentativa expirou ou o Render reiniciou. Inicie uma nova conexão.";
  return "Não foi possível comunicar com a API. Verifique o serviço no Render e tente novamente.";
}

export function AreaCentralExtensionLogin() {
  const { completeAreaCentralBrowserLogin } = useAuth();
  const [state, setState] = useState<AreaCentralBrowserTransferState | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [missing, setMissing] = useState(false);
  const [retry, setRetry] = useState(0);
  const working = useRef(false);
  const mounted = useRef(true);
  const completingGrant = useRef<string | null>(null);
  useEffect(() => {
    mounted.current = true;
    const onTransfer = (event: MessageEvent) => {
      if (
        event.source !== window ||
        event.origin !== location.origin ||
        event.data?.source !== "redeasso-extension" ||
        event.data?.type !== "TRANSFER_RESULT"
      )
        return;
      if (event.data.code === "TRANSFER_FAILED")
        setError(
          "A extensão não conseguiu enviar a sessão. Verifique a conexão, cancele e tente novamente.",
        );
      if (event.data.code === "VALIDATION_FAILED")
        setError(
          "Não foi possível validar a sessão recebida da Área Central. Tente uma nova conexão.",
        );
      if (event.data.code === "RECEIVED") {
        // Notificação acorda a guia em segundo plano; o estado confiável continua vindo do Spring.
        void getCurrentAreaCentralBrowserTransfer()
          .then((current) => {
            if (mounted.current && !working.current) setState(current);
          })
          .catch((cause) => {
            if (mounted.current) setError(errorMessage(cause));
          });
      }
    };
    window.addEventListener("message", onTransfer);
    const controller = new AbortController();
    // Permite voltar/reabrir a guia sem perder uma tentativa ainda válida.
    getCurrentAreaCentralBrowserTransfer({ signal: controller.signal })
      .then((current) => {
        if (mounted.current && !working.current) setState(current);
      })
      .catch(() => {
        /* Não existir tentativa é normal na primeira abertura. */
      });
    return () => {
      mounted.current = false;
      controller.abort();
      window.removeEventListener("message", onTransfer);
    };
  }, []);

  useEffect(() => {
    if (
      !state ||
      state.status === "READY_TO_COMPLETE" ||
      state.status === "REJECTED"
    )
      return;
    let active = true;
    let timer: number;
    const controller = new AbortController();
    async function poll() {
      try {
        const next = await getCurrentAreaCentralBrowserTransfer({
          signal: controller.signal,
        });
        if (!active) return;
        setState(next);
        if (!["READY_TO_COMPLETE", "REJECTED"].includes(next.status))
          timer = window.setTimeout(() => void poll(), 3_000);
      } catch (cause) {
        if (active) setError(errorMessage(cause));
      }
    }
    timer = window.setTimeout(() => void poll(), 1_000);
    return () => {
      active = false;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [
    state?.expiresAt,
    state?.status === "READY_TO_COMPLETE",
    state?.status === "REJECTED",
    retry,
  ]);

  useEffect(() => {
    if (
      state?.status !== "READY_TO_COMPLETE" ||
      completingGrant.current === state.expiresAt
    )
      return;
    completingGrant.current = state.expiresAt;
    working.current = true;
    setBusy(true);
    setError("");
    void autoCompleteAreaCentral(completeAreaCentralBrowserLogin, () =>
      areaCentralExtension("COMPLETE"),
    )
      .catch(() => {
        if (mounted.current)
          setError(
            "Não foi possível concluir o acesso. Inicie uma nova conexão.",
          );
      })
      .finally(() => {
        working.current = false;
        if (mounted.current) setBusy(false);
      });
  }, [state?.status, state?.expiresAt, completeAreaCentralBrowserLogin]);

  async function start(restart = false) {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setError("");
    setMissing(false);
    let created = false;
    try {
      const extension = await areaCentralExtension("PING");
      if (!extension.ok || extension.version !== 2) {
        setMissing(true);
        setError(
          "Instale ou atualize a extensão RedeASSO e recarregue esta página para conectar a Área Central.",
        );
        return;
      }
      if (restart) {
        await resetAreaCentralTransfer(cancelAreaCentralBrowserTransfer, () =>
          areaCentralExtension("CANCEL"),
        );
        if (mounted.current) setState(null);
      }
      const grant = await startAreaCentralBrowserTransfer({
        signal: AbortSignal.timeout(30_000),
      });
      created = true;
      const opened = await areaCentralExtension("START", grant);
      if (!opened.ok) {
        await cancelAreaCentralBrowserTransfer();
        created = false;
        setError(
          opened.code === "BUSY"
            ? "Já existe uma conexão em andamento nesta extensão. Cancele-a na guia original ou aguarde dez minutos."
            : "A extensão não conseguiu abrir a Área Central. Recarregue a página e tente novamente.",
        );
        return;
      }
      if (mounted.current)
        setState({ status: "WAITING_FOR_BROWSER", expiresAt: grant.expiresAt });
    } catch (cause) {
      if (created) {
        void cancelAreaCentralBrowserTransfer().catch(() => {
          /* A concessão também expira no servidor. */
        });
        void areaCentralExtension("CANCEL");
      }
      if (mounted.current) setError(errorMessage(cause));
    } finally {
      working.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  async function cancel() {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    try {
      await cancelAreaCentralBrowserTransfer();
      await areaCentralExtension("CANCEL");
      setState(null);
      setError("");
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      working.current = false;
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4">
      <p className="text-sm leading-relaxed text-gray-600">
        Entre na página real da Área Central, em uma nova guia do seu navegador.
        A extensão conecta a sessão ao RedeASSO sem capturar sua senha. O acesso
        dura até 12 horas, enquanto a sessão continuar válida.
      </p>
      {!state && (
        <button
          type="button"
          onClick={() => void start()}
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-black px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <ShieldCheck className="h-4 w-4" />
          )}
          {busy ? "Preparando conexão..." : "Entrar com Área Central"}
        </button>
      )}
      <details open={missing || undefined} className="text-sm text-zinc-600">
        <summary className="cursor-pointer font-medium">
          Instalar a extensão RedeASSO (uma vez por computador)
        </summary>
        <ol className="mt-3 list-decimal space-y-2 pl-5">
          <li>
            <a
              href="/extensions/redeasso-area-central.zip"
              download
              className="underline"
            >
              Baixe a extensão
            </a>{" "}
            e extraia o ZIP em uma pasta permanente.
          </li>
          <li>
            Abra <code>chrome://extensions</code> (ou{" "}
            <code>edge://extensions</code>) e ative o modo do desenvolvedor.
          </li>
          <li>
            Clique em “Carregar sem compactação” e selecione a pasta extraída,
            que contém <code>manifest.json</code>.
          </li>
          <li>
            Confira as permissões da Área Central e do RedeASSO. Depois
            recarregue esta página.
          </li>
        </ol>
        <a
          href={INSTALL_GUIDE}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-2 underline"
        >
          <ExternalLink className="h-4 w-4" /> Instruções completas e
          atualização
        </a>
      </details>
      {error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-zinc-300 bg-zinc-100 p-3 text-sm"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </p>
      )}
      {state && (
        <div className="space-y-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm">
          <p role="status">
            {state.status === "READY_TO_COMPLETE"
              ? "Sessão validada. Entrando automaticamente..."
              : state.status === "VALIDATING"
                ? "Validando a sessão da Área Central no Render..."
                : state.status === "REJECTED"
                  ? "A tentativa foi recusada e não pode ser reutilizada. Clique em “Tentar novamente” para iniciar outra conexão. Se persistir, consulte o diagnóstico no Render."
                  : "Entre na guia da Área Central. Após a validação do portal, o acesso será concluído e você voltará ao app automaticamente."}
          </p>
          <div className="flex flex-wrap gap-4">
            {state.status === "WAITING_FOR_BROWSER" && (
              <button
                type="button"
                onClick={() => void areaCentralExtension("FOCUS")}
                className="underline"
              >
                Ver guia da Área Central
              </button>
            )}
            {state.status === "REJECTED" ||
            (state.status === "READY_TO_COMPLETE" && error) ? (
              <button
                type="button"
                onClick={() => void start(true)}
                disabled={busy}
                className="underline disabled:opacity-60"
              >
                Tentar novamente
              </button>
            ) : (
              error && (
                <button
                  type="button"
                  onClick={() => {
                    setError("");
                    setRetry((value) => value + 1);
                  }}
                  disabled={busy}
                  className="underline disabled:opacity-60"
                >
                  Verificar novamente
                </button>
              )
            )}
            <button
              type="button"
              onClick={() => void cancel()}
              disabled={busy}
              className="underline disabled:opacity-60"
            >
              Cancelar conexão
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
