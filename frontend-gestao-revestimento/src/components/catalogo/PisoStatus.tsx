import {
  useGetStatusCores,
  getGetStatusCoresQueryKey,
  type Piso,
} from "@workspace/api-client-react";
import {
  pisoStatus,
  STATUS_LABELS,
  STATUS_COLORS,
  statusTextColor,
} from "@/lib/piso-status";
export function PisoStatus({
  piso,
}: {
  piso: Pick<Piso, "codigoRede" | "statusAreaCentral">;
}) {
  const { data } = useGetStatusCores({
    query: { queryKey: getGetStatusCoresQueryKey(), staleTime: 60000 },
  });
  const codigo = pisoStatus(piso),
    cor =
      data?.find((item) => item.codigo === codigo)?.cor ||
      STATUS_COLORS[codigo] ||
      "#64748b";
  return (
    <span
      className="inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={{ backgroundColor: cor, color: statusTextColor(cor) }}
      title="Status da Área Central (não substitui Ativo/Inativo)"
    >
      {STATUS_LABELS[codigo] ||
        (codigo === "NAO_CONSULTADO"
          ? "Não consultado"
          : piso.statusAreaCentral)}
    </span>
  );
}
