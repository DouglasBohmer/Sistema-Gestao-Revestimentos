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
import { stockCellState, type StockRowState } from "@/lib/piso-list-state";

export function useAreaCentralStock(
  pisos: Piso[] | undefined,
  editing: boolean,
) {
  const { session } = useAuth();
  const [location] = useLocation();
  const client = useQueryClient();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [rowStates, setRowStates] = useState(new Map<number, StockRowState>());
  const generation = useRef(0);
  const currentIds = useRef(new Set<number>());
  currentIds.current = new Set(pisos?.map((piso) => piso.id));
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
        const currentGeneration = generation.current;
        if (alive.current) setBusy(true);
        try {
          const results = await atualizarPisosAreaCentral(
            { ids },
            { signal: AbortSignal.timeout(65_000) },
          );
          if (!alive.current || currentGeneration !== generation.current)
            return;
          const updates = new Map(
            results
              .filter((item) => item.piso)
              .map((item) => [item.id, item.piso!]),
          );
          client.setQueriesData<Piso[]>(
            { queryKey: getListPisosQueryKey() },
            (current) => current?.map((piso) => updates.get(piso.id) ?? piso),
          );
          setRowStates((previous) => {
            const next = new Map(previous);
            results.forEach((item) =>
              next.set(
                item.id,
                item.status === "FAILED"
                  ? "FAILED"
                  : item.status === "NOT_FOUND"
                    ? "NOT_FOUND"
                    : "READY",
              ),
            );
            return next;
          });
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
        } catch (cause) {
          if (currentGeneration !== generation.current) return;
          if (alive.current && currentGeneration === generation.current) {
            setRowStates((previous) => {
              const next = new Map(previous);
              ids.forEach((id) => next.set(id, "FAILED"));
              return next;
            });
          }
          throw cause;
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
      (id) => {
        if (alive.current)
          setRowStates((previous) => new Map(previous).set(id, "UPDATING"));
      },
      (id) => {
        const rect = nodes.current.get(id)?.getBoundingClientRect();
        return (
          currentIds.current.has(id) &&
          !!rect &&
          rect.width > 0 &&
          rect.top < window.innerHeight + 80 &&
          rect.bottom > -80
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
    generation.current++;
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
  const cellState = (piso: Piso) =>
    stockCellState(piso, connected, rowStates.get(piso.id));
  return { registerRow, refreshVisible, busy, error, connected, cellState };
}
