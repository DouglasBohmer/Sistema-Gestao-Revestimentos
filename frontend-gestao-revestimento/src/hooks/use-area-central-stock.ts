import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  atualizarPisosAreaCentral,
  getListPisosQueryKey,
  type Piso,
} from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { createAreaCentralRefreshQueue } from "@/lib/area-central-refresh-queue";

export function useAreaCentralStock(
  pisos: Piso[] | undefined,
  editing: boolean,
) {
  const { session } = useAuth();
  const [location] = useLocation();
  const client = useQueryClient();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const nodes = useRef(new Map<number, HTMLTableRowElement>());
  const observer = useRef<IntersectionObserver | null>(null);
  const alive = useRef(true);
  const active = useRef(false);
  const blocked = useRef(false);
  const connected = session?.areaCentralConnected === true;
  active.current = connected && !editing && location === "/cadastro";
  const queue = useRef<ReturnType<typeof createAreaCentralRefreshQueue> | null>(
    null,
  );
  if (!queue.current)
    queue.current = createAreaCentralRefreshQueue(
      async (ids) => {
        if (alive.current) setBusy(true);
        try {
          const results = await atualizarPisosAreaCentral(
            { ids },
            { signal: AbortSignal.timeout(65_000) },
          );
          if (!alive.current) return;
          const updates = new Map(
            results
              .filter((item) => item.piso)
              .map((item) => [item.id, item.piso!]),
          );
          client.setQueriesData<Piso[]>(
            { queryKey: getListPisosQueryKey() },
            (current) => current?.map((piso) => updates.get(piso.id) ?? piso),
          );
          const failed = results.find((item) => item.status === "FAILED");
          if (failed) {
            if (
              failed.code === "SESSION_EXPIRED" ||
              failed.code === "SESSION_REQUIRED"
            )
              blocked.current = true;
            setError(
              blocked.current
                ? "A sessão da Área Central expirou. Conecte novamente para atualizar."
                : "Algumas consultas falharam. Os últimos valores foram mantidos; use “Atualizar visíveis” para tentar novamente.",
            );
          }
        } finally {
          if (alive.current) setBusy(false);
        }
      },
      () => active.current && !blocked.current && alive.current,
      () => {
        if (alive.current)
          setError(
            "Não foi possível consultar a Área Central. Os últimos valores foram mantidos.",
          );
      },
    );

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const registerRow = useCallback(
    (id: number, node: HTMLTableRowElement | null) => {
      const previous = nodes.current.get(id);
      if (previous) observer.current?.unobserve(previous);
      if (node) {
        nodes.current.set(id, node);
        observer.current?.observe(node);
      } else nodes.current.delete(id);
    },
    [],
  );
  const idsKey =
    pisos
      ?.filter((piso) => piso.codigoRede)
      .map((piso) => piso.id)
      .join(",") ?? "";
  useEffect(() => {
    if (!connected || editing || location !== "/cadastro") return;
    const externalIds = new Set(
      pisos?.filter((piso) => piso.codigoRede).map((piso) => piso.id),
    );
    const instance = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          if (entry.isIntersecting) {
            const id = Number((entry.target as HTMLElement).dataset.pisoId);
            if (externalIds.has(id)) queue.current!.enqueue(id);
          }
      },
      { rootMargin: "80px" },
    );
    observer.current = instance;
    nodes.current.forEach((node) => instance.observe(node));
    return () => {
      observer.current = null;
      instance.disconnect();
    };
  }, [connected, editing, location, idsKey]);
  function refreshVisible() {
    setError("");
    queue.current!.reset();
    const ids = new Set(
      pisos?.filter((piso) => piso.codigoRede).map((piso) => piso.id),
    );
    nodes.current.forEach((node, id) => {
      const rect = node.getBoundingClientRect();
      if (
        ids.has(id) &&
        rect.width > 0 &&
        rect.top < window.innerHeight &&
        rect.bottom > 0
      )
        queue.current!.enqueue(id);
    });
  }
  return { registerRow, refreshVisible, busy, error, connected };
}
