/** Uma fila por tela: até quatro itens por chamada, sem repetir linha a cada render. */
export function createAreaCentralRefreshQueue(
  refresh: (ids: number[]) => Promise<void>,
  allowed: () => boolean,
  onError: () => void,
  onQueued: (id: number) => void = () => {},
  relevant: (id: number) => boolean = () => true,
) {
  const pending = new Set<number>();
  const seen = new Set<number>();
  let running = false;
  async function run() {
    if (running) return;
    running = true;
    try {
      while (pending.size && allowed()) {
        for (const id of pending)
          if (!relevant(id)) {
            pending.delete(id);
            seen.delete(id);
          }
        const ids = [...pending].slice(0, 4);
        if (!ids.length) break;
        ids.forEach((id) => pending.delete(id));
        try {
          await refresh(ids);
        } catch {
          onError();
          break;
        }
      }
    } finally {
      // Itens não consultados podem reaparecer quando a tela voltar a ficar ativa.
      pending.forEach((id) => seen.delete(id));
      pending.clear();
      running = false;
    }
  }
  return {
    enqueue(id: number) {
      if (!allowed() || seen.has(id)) return;
      seen.add(id);
      pending.add(id);
      onQueued(id);
      queueMicrotask(() => void run());
    },
    reset() {
      seen.clear();
      pending.clear();
    },
  };
}
