import type { CalculoResult } from "@workspace/api-client-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
const numero = (valor: number) =>
  valor.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
export function ResumoVenda({
  resultado,
  open,
  onOpenChange,
}: {
  resultado: CalculoResult;
  open: boolean;
  onOpenChange: (value: boolean) => void;
}) {
  const itens = [
    ["Caixas", `${resultado.quantidadeCaixas} caixas`],
    ["Argamassas", `${resultado.quantidadeSacosArgamassa} sacos`],
    [
      "Rejuntes",
      resultado.quantidadeEmbalagensRejunte == null
        ? "Não calculado"
        : `${resultado.quantidadeEmbalagensRejunte} embalagens`,
    ],
    [
      "Niveladores",
      resultado.quantidadePacotesNiveladores == null
        ? "Não calculado"
        : `${resultado.quantidadePacotesNiveladores} pacotes (${resultado.quantidadeNiveladores} peças)`,
    ],
  ];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Resumo da venda</DialogTitle>
          <DialogDescription>{resultado.piso.nome}</DialogDescription>
        </DialogHeader>
        <div className="rounded-xl bg-foreground p-5 text-background">
          <p className="text-sm">M² Digitar no Cupom</p>
          <p className="mt-1 text-4xl font-bold">
            {numero(resultado.metragemVendidaM2)}{" "}
            <span className="text-lg">m²</span>
          </p>
        </div>
        <dl className="divide-y">
          {itens.map(([nome, valor]) => (
            <div key={nome} className="flex justify-between gap-4 py-3">
              <dt className="text-muted-foreground">{nome}</dt>
              <dd className="text-right font-semibold">{valor}</dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
}
