export const STATUS_LABELS: Record<string, string> = {
  PADRAO: "Padrão",
  ACABAR: "Acabar",
  NEGOCIACAO: "Negociação",
  FORA_DE_LINHA: "Fora de linha",
  PRODUTO_LOCAL: "Produto local",
};
export const STATUS_COLORS: Record<string, string> = {
  PADRAO: "#15803d",
  ACABAR: "#2563eb",
  NEGOCIACAO: "#7c3aed",
  FORA_DE_LINHA: "#c2410c",
  PRODUTO_LOCAL: "#475569",
};
export function pisoStatus(piso: {
  codigoRede?: string | null;
  statusAreaCentral?: string | null;
}) {
  if (!piso.codigoRede) return "PRODUTO_LOCAL";
  const status = piso.statusAreaCentral
    ?.trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replaceAll(" ", "_");
  if (status === "NAO_ENCONTRADO" || status === "FORA_DE_LINHA")
    return "FORA_DE_LINHA";
  return status || "NAO_CONSULTADO";
}
export function statusTextColor(hex: string) {
  const c = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4]
    .map((i) => parseInt(c.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.179 ? "#000000" : "#ffffff";
}
