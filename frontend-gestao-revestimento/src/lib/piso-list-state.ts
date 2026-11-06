import type { Piso } from "@workspace/api-client-react";

export type PisoFilters = {
  onlyActive: boolean;
  tipo: string;
  classificacao: string;
  bordas: string;
};
export const EMPTY_PISO_FILTERS: PisoFilters = {
  onlyActive: false,
  tipo: "",
  classificacao: "",
  bordas: "",
};
export function filterPisos(pisos: Piso[] | undefined, filters: PisoFilters) {
  return pisos?.filter(
    (piso) =>
      (!filters.onlyActive || piso.ativo) &&
      (!filters.tipo ||
        piso.tipoPiso
          ?.toLocaleLowerCase("pt-BR")
          .includes(filters.tipo.trim().toLocaleLowerCase("pt-BR"))) &&
      (!filters.classificacao ||
        piso.classificacaoUso === filters.classificacao) &&
      (!filters.bordas || piso.acabamentoBordas === filters.bordas),
  );
}
export type StockRowState = "UPDATING" | "READY" | "FAILED" | "NOT_FOUND";
export function stockCellState(
  piso: Pick<
    Piso,
    "codigoRede" | "ultimaConsultaAreaCentralEm" | "statusAreaCentral"
  > &
    Partial<Pick<Piso, "origemValor" | "origemEstoque">>,
  connected: boolean,
  state?: StockRowState,
) {
  if (!piso.codigoRede) return "READY";
  if (connected && (!state || state === "UPDATING")) return "UPDATING";
  if (state === "NOT_FOUND" || piso.statusAreaCentral === "NAO_ENCONTRADO")
    return "NOT_FOUND";
  if (
    !piso.ultimaConsultaAreaCentralEm &&
    piso.origemValor !== "MANUAL" &&
    piso.origemEstoque !== "MANUAL"
  )
    return "UNAVAILABLE";
  return "READY";
}
