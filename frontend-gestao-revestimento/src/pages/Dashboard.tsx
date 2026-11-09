import {
  useListCalculosRecentes,
  useListPisosRecentes,
} from "@workspace/api-client-react";
import { Link, useLocation } from "wouter";
import { Layout } from "@/components/layout/Layout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calculator, Package, ArrowUpRight } from "lucide-react";
import { PisoStatus } from "@/components/catalogo/PisoStatus";
const data = (value: string) => new Date(value).toLocaleString("pt-BR");
export default function Dashboard() {
  const [location] = useLocation();
  const calculos = useListCalculosRecentes({
    query: { queryKey: ["/api/calculos/historico"], enabled: location === "/" },
  });
  const pisos = useListPisosRecentes({
    query: { queryKey: ["/api/pisos/recentes"], enabled: location === "/" },
  });
  return (
    <Layout>
      <div className="space-y-6 p-6 lg:p-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Início</h1>
            <p className="mt-1 text-muted-foreground">
              Retome um cálculo ou consulte os últimos pisos do sistema.
            </p>
          </div>
          <Button asChild>
            <Link href="/calcular">
              <Calculator className="mr-2 size-4" />
              Novo cálculo
            </Link>
          </Button>
        </header>
        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="size-5" />
                Últimos cálculos
              </CardTitle>
              <CardDescription>
                15 resultados mais recentes de todo o sistema. Reabrir preserva
                os dados originais.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {calculos.isLoading ? (
                <p role="status">Carregando cálculos...</p>
              ) : calculos.isError ? (
                <p role="alert">Não foi possível carregar o histórico.</p>
              ) : !calculos.data?.length ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum cálculo salvo ainda. Os novos cálculos aparecerão aqui.
                </p>
              ) : (
                calculos.data.map((item) => (
                  <Link
                    key={item.id}
                    href={`/calcular?historico=${item.id}`}
                    className="flex items-center justify-between gap-3 rounded-lg border p-3 hover:bg-muted/50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {item.pisoNome}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {data(item.criadoEm)} · {item.quantidadeCaixas} caixas ·{" "}
                        {item.metragemVendidaM2.toLocaleString("pt-BR")} m²
                      </p>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1 text-sm">
                      Reabrir
                      <ArrowUpRight className="size-4" />
                    </span>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="size-5" />
                Pisos recém-cadastrados
              </CardTitle>
              <CardDescription>
                Os 15 cadastros mais recentes, sem confundir cadastro com
                atualização de estoque.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {pisos.isLoading ? (
                <p role="status">Carregando pisos...</p>
              ) : pisos.isError ? (
                <p role="alert">Não foi possível carregar os pisos.</p>
              ) : !pisos.data?.length ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum piso cadastrado.
                </p>
              ) : (
                pisos.data.map((piso) => (
                  <Link
                    key={piso.id}
                    href={`/cadastro?piso=${piso.id}`}
                    className="flex items-center justify-between gap-3 rounded-lg border p-3 hover:bg-muted/50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {piso.nome}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {data(piso.createdAt)} · ASSO {piso.codigoRede || "—"} ·
                        CTC {piso.codigoLoja || "—"}
                      </p>
                    </div>
                    <PisoStatus piso={piso} />
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
