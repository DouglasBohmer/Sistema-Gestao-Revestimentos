import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  ApiError,
  useGetStatusCores,
  getGetStatusCoresQueryKey,
  salvarStatusCores,
  type StatusCor,
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout/Layout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ParametrosPrecoDialog } from "@/components/catalogo/ParametrosPrecoDialog";
import { STATUS_LABELS, statusTextColor } from "@/lib/piso-status";
import { areaCentralExtension } from "@/components/auth/area-central-extension";
export default function Configuracoes() {
  const [location] = useLocation(),
    client = useQueryClient();
  const query = useGetStatusCores({
    query: {
      queryKey: getGetStatusCoresQueryKey(),
      enabled: location === "/configuracoes",
    },
  });
  const [cores, setCores] = useState<StatusCor[] | null>(null),
    [saving, setSaving] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => {
    if (query.data && !cores) setCores(query.data);
  }, [query.data, cores]);
  async function save() {
    if (!cores || saving) return;
    setSaving(true);
    setMessage("");
    try {
      const result = await salvarStatusCores({ status: cores });
      setCores(result);
      client.setQueryData(getGetStatusCoresQueryKey(), result);
      setMessage("Cores salvas.");
    } catch (cause) {
      setMessage(
        cause instanceof ApiError && cause.status === 409
          ? "Outra sessão alterou as cores. Recarregue os valores antes de salvar."
          : "Não foi possível salvar as cores.",
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <Layout>
      <div className="mx-auto max-w-4xl space-y-6 p-6 lg:p-8">
        <h1 className="text-3xl font-bold">Configurações</h1>
        <Card>
          <CardHeader>
            <CardTitle>Sessão da Área Central por arquivo</CardTitle>
            <CardDescription>
              Configuração local deste Chrome/Edge. Não é uma sessão global no
              Neon.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p>
              Selecione um .txt na pasta compartilhada da sua loja. Uma máquina
              faz o login e salva a sessão; os outros computadores que
              autorizaram esse mesmo arquivo podem reutilizá-la, enquanto
              válida. Sem arquivo ou em caso de falha, o app abre o login
              individual.
            </p>
            <p className="text-amber-800">
              O arquivo dá acesso à conta. Restrinja a pasta a pessoas e PCs
              autorizados. Não publique nem compartilhe fora da loja. O Chrome
              pode exigir renovar a permissão após reiniciar.
            </p>
            <Button
              onClick={() =>
                void areaCentralExtension("OPEN_OPTIONS").then((reply) => {
                  if (!reply.ok)
                    setMessage(
                      "Instale ou atualize a extensão RedeASSO 1.2.0 e recarregue o app.",
                    );
                })
              }
            >
              Escolher arquivo .txt na extensão
            </Button>
            <p className="text-muted-foreground">
              A seleção ocorre na página privativa da extensão; o app não recebe
              o caminho nem o conteúdo. Não digite cookies aqui.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Cores dos status</CardTitle>
            <CardDescription>
              Cores de apresentação em todo o sistema. Ativo/Inativo e estoque
              continuam independentes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!cores ? (
              <p role="status">
                {query.isError
                  ? "Não foi possível carregar as cores."
                  : "Carregando cores..."}
              </p>
            ) : (
              cores.map((item) => (
                <div
                  key={item.codigo}
                  className="flex items-center justify-between gap-4 rounded-lg border p-3"
                >
                  <Label htmlFor={`cor-${item.codigo}`}>
                    {STATUS_LABELS[item.codigo]}
                  </Label>
                  <div className="flex items-center gap-3">
                    <span
                      className="rounded-full px-3 py-1 text-xs"
                      style={{
                        backgroundColor: item.cor,
                        color: statusTextColor(item.cor),
                      }}
                    >
                      {STATUS_LABELS[item.codigo]}
                    </span>
                    <input
                      id={`cor-${item.codigo}`}
                      type="color"
                      className="h-9 w-12 cursor-pointer rounded border bg-transparent"
                      disabled={saving}
                      value={item.cor}
                      onChange={(event) =>
                        setCores(
                          cores.map((row) =>
                            row.codigo === item.codigo
                              ? { ...row, cor: event.target.value }
                              : row,
                          ),
                        )
                      }
                    />
                  </div>
                </div>
              ))
            )}
            <div className="flex gap-3">
              <Button disabled={!cores || saving} onClick={() => void save()}>
                {saving ? "Salvando..." : "Salvar cores"}
              </Button>
              <Button
                variant="outline"
                disabled={saving || query.isFetching}
                onClick={() =>
                  void query.refetch().then((result) => {
                    if (result.data) {
                      setCores(result.data);
                      setMessage("Valores recarregados.");
                    }
                  })
                }
              >
                Recarregar valores
              </Button>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Preço de venda</CardTitle>
            <CardDescription>
              Margem sobre o bruto e desconto por m².
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ParametrosPrecoDialog
              onSaved={() =>
                void client.invalidateQueries({ queryKey: ["/api/pisos"] })
              }
            />
          </CardContent>
        </Card>
        {message && (
          <p role="status" className="rounded-lg border p-3 text-sm">
            {message}
          </p>
        )}
      </div>
    </Layout>
  );
}
