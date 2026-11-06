import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ApiError,
  useGetParametrosPreco,
  useSalvarParametrosPreco,
  getGetParametrosPrecoQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SlidersHorizontal } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function ParametrosPrecoDialog({ onSaved }: { onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [margem, setMargem] = useState("");
  const [desconto, setDesconto] = useState("");
  const [error, setError] = useState("");
  const loaded = useRef(false);
  const base = useRef<{ versaoMargem: number; versaoDesconto: number } | null>(
    null,
  );
  const client = useQueryClient();
  const { toast } = useToast();
  const query = useGetParametrosPreco({
    query: {
      queryKey: getGetParametrosPrecoQueryKey(),
      enabled: open,
      staleTime: 0,
    },
  });
  const mutation = useSalvarParametrosPreco();
  useEffect(() => {
    if (!open || loaded.current || query.isFetching || !query.data) return;
    loaded.current = true;
    base.current = query.data;
    setMargem(String(query.data.margemPercentual));
    setDesconto(String(query.data.descontoPercentual));
  }, [open, query.data, query.isFetching]);
  function changeOpen(next: boolean) {
    if (mutation.isPending) return;
    if (!next) {
      loaded.current = false;
      base.current = null;
      setMargem("");
      setDesconto("");
      setError("");
    }
    setOpen(next);
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!base.current || mutation.isPending) return;
    setError("");
    try {
      const result = await mutation.mutateAsync({
        data: {
          ...base.current,
          margemPercentual: Number(margem),
          descontoPercentual: Number(desconto),
        },
      });
      client.setQueryData(getGetParametrosPrecoQueryKey(), result);
      loaded.current = false;
      base.current = null;
      setMargem("");
      setDesconto("");
      setOpen(false);
      toast({
        title: "Parâmetros salvos",
        description:
          "Os itens visíveis serão consultados com os novos percentuais.",
      });
      onSaved();
    } catch (cause) {
      setError(
        cause instanceof ApiError && cause.status === 409
          ? "Outra sessão alterou os parâmetros. Feche e reabra esta janela antes de salvar."
          : "Não foi possível salvar. Confira os percentuais e tente novamente.",
      );
    }
  }
  const ready =
    loaded.current &&
    !query.isError &&
    margem !== "" &&
    desconto !== "" &&
    Number.isFinite(Number(margem)) &&
    Number(margem) >= 0 &&
    Number.isFinite(Number(desconto)) &&
    Number(desconto) >= 0 &&
    Number(desconto) <= 100;
  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline">
          <SlidersHorizontal className="mr-2 size-4" />
          Parâmetros
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Parâmetros de preço</DialogTitle>
          <DialogDescription>
            Aplicados ao valor bruto por m² da Área Central. O preço de venda
            segue o arredondamento comercial.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="preco-margem">Margem sobre o bruto (%)</Label>
            <Input
              id="preco-margem"
              type="number"
              min="0"
              step="any"
              required
              disabled={!loaded.current || mutation.isPending}
              value={margem}
              onChange={(event) => setMargem(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="preco-desconto">Desconto (%)</Label>
            <Input
              id="preco-desconto"
              type="number"
              min="0"
              max="100"
              step="any"
              required
              disabled={!loaded.current || mutation.isPending}
              value={desconto}
              onChange={(event) => setDesconto(event.target.value)}
            />
          </div>
          {query.isFetching && !loaded.current && (
            <p role="status" className="text-sm text-muted-foreground">
              Carregando parâmetros...
            </p>
          )}
          {(error || query.isError) && (
            <p role="alert" className="text-sm text-destructive">
              {error ||
                "Não foi possível carregar os parâmetros. Feche e tente novamente."}
            </p>
          )}
          <Button
            type="submit"
            className="w-full"
            disabled={!ready || mutation.isPending}
          >
            {mutation.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
