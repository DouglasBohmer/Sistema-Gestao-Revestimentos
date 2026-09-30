import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Calculator,
  CheckCircle2,
  ExternalLink,
  ImageIcon,
  Info,
  Layers,
  Loader2,
  MessageCircle,
  Package,
  Ruler,
  Search,
  ShoppingCart,
} from "lucide-react";

import {
  listPisosByCodigo,
  useCalcularPiso,
  type CalculoResult,
  type Piso,
} from "@workspace/api-client-react";

import {
  PisoImage,
  legacyProductImageFallback,
} from "@/components/catalogo/PisoImage";
import { Layout } from "@/components/layout/Layout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type ModoEntrada = "METRAGEM" | "CAIXAS";

type QuantidadeInformada = {
  modo: ModoEntrada;
  valor: number;
};

const MARGEM_QUEBRA = 10;

const formatadorMoeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function formatarNumero(valor: number, maximoCasas = 2) {
  if (!Number.isFinite(valor)) return "—";

  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: maximoCasas,
  }).format(valor);
}

function formatarMetragem(valor: number) {
  return `${formatarNumero(valor, 2)} m²`;
}

function parseNumero(valor: string) {
  return Number(valor.trim().replace(",", "."));
}

function mascararEntradaMetragem(valor: string) {
  const digitos = valor.replace(/\D/g, "").replace(/^0+(?=\d)/, "") || "0";
  const valorComCentavos = digitos.padStart(3, "0");
  const separador = valorComCentavos.length - 2;

  return `${valorComCentavos.slice(0, separador)},${valorComCentavos.slice(separador)}`;
}

function posicionarCursorNoFim(input: HTMLInputElement) {
  const fim = input.value.length;
  input.setSelectionRange(fim, fim);
}

function obterDigitosTelefoneNacional(valor: string) {
  const digitos = valor.replace(/\D/g, "");
  const possuiPrefixoInternacional = /^\s*\+\s*55/.test(valor);
  const possuiCodigoPaisColado =
    digitos.startsWith("55") && digitos.length > 11;
  const numeroNacional =
    possuiPrefixoInternacional || possuiCodigoPaisColado
      ? digitos.slice(2)
      : digitos;

  return numeroNacional.slice(0, 11);
}

function mascararTelefone(valor: string) {
  const digitos = obterDigitosTelefoneNacional(valor);

  if (!digitos) return "";
  if (digitos.length <= 2) return `(${digitos}`;

  const ddd = digitos.slice(0, 2);
  const numero = digitos.slice(2);
  const tamanhoPrefixo = numero.length > 8 ? 5 : 4;

  if (numero.length <= tamanhoPrefixo) {
    return `(${ddd}) ${numero}`;
  }

  return `(${ddd}) ${numero.slice(0, tamanhoPrefixo)}-${numero.slice(tamanhoPrefixo)}`;
}

function normalizarTelefone(valor: string) {
  const digitos = valor.replace(/\D/g, "");

  if (
    digitos.startsWith("55") &&
    (digitos.length === 12 || digitos.length === 13)
  ) {
    return digitos;
  }
  if (digitos.length === 10 || digitos.length === 11) {
    return `55${digitos}`;
  }
  return null;
}

function acabamento(piso: Piso) {
  return piso.acabamentoBordas === "RETIFICADO" ? "Retificado" : "Bold";
}

type ResumoCalculo = {
  metragemVendidaM2: number;
  quantidadeSacosArgamassa: number;
  pesoArgamassaKg: number;
  quantidadeEmbalagensRejunte: number | null;
  pesoRejunteKg: number | null;
  niveladoresLadoX: number | null;
  niveladoresLadoY: number | null;
  quantidadeNiveladores: number | null;
  quantidadePacotesNiveladores: number | null;
};

function numeroFinito(valor: unknown): valor is number {
  return typeof valor === "number" && Number.isFinite(valor);
}

function numeroDaApiOuFallback(valor: unknown, fallback: number) {
  return numeroFinito(valor) ? valor : fallback;
}

function numeroNullableDaApiOuFallback(
  valor: unknown,
  fallback: number | null,
) {
  if (valor === null) return null;
  return numeroFinito(valor) ? valor : fallback;
}

function normalizarResumoCalculo(
  resultado: CalculoResult,
  piso: Piso,
): ResumoCalculo {
  const metragemVendidaFallback = resultado.quantidadeCaixas * piso.m2PorCaixa;
  const metragemVendidaM2 = numeroDaApiOuFallback(
    resultado.metragemVendidaM2,
    metragemVendidaFallback,
  );

  const quantidadeSacosArgamassaFallback = Math.ceil(metragemVendidaM2 / 3);
  const pesoArgamassaKgFallback = (metragemVendidaM2 / 3) * 20;

  let pesoRejunteKgFallback: number | null = null;
  let quantidadeEmbalagensRejunteFallback: number | null = null;
  if (
    piso.largura &&
    piso.largura > 0 &&
    piso.altura &&
    piso.altura > 0 &&
    piso.rejunte &&
    piso.rejunte > 0
  ) {
    const larguraMm = piso.largura * 10;
    const alturaMm = piso.altura * 10;
    const kgPorM2 =
      ((larguraMm + alturaMm) * 9 * piso.rejunte * 1.8) /
      (larguraMm * alturaMm);
    pesoRejunteKgFallback = metragemVendidaM2 * kgPorM2;
    quantidadeEmbalagensRejunteFallback = Math.ceil(pesoRejunteKgFallback);
  }

  let niveladoresLadoXFallback: number | null = null;
  let niveladoresLadoYFallback: number | null = null;
  let quantidadeNiveladoresFallback: number | null = null;
  let quantidadePacotesNiveladoresFallback: number | null = null;
  if (piso.largura && piso.largura > 0 && piso.altura && piso.altura > 0) {
    niveladoresLadoXFallback = Math.max(1, Math.ceil(piso.largura / 40));
    niveladoresLadoYFallback = Math.max(1, Math.ceil(piso.altura / 40));
    const areaPecaM2 = (piso.largura * piso.altura) / 10_000;
    quantidadeNiveladoresFallback = Math.ceil(
      ((niveladoresLadoXFallback + niveladoresLadoYFallback) *
        metragemVendidaM2) /
        areaPecaM2,
    );
    quantidadePacotesNiveladoresFallback = Math.ceil(
      quantidadeNiveladoresFallback / 100,
    );
  }

  return {
    metragemVendidaM2,
    quantidadeSacosArgamassa: numeroDaApiOuFallback(
      resultado.quantidadeSacosArgamassa,
      quantidadeSacosArgamassaFallback,
    ),
    pesoArgamassaKg: numeroDaApiOuFallback(
      resultado.pesoArgamassaKg,
      pesoArgamassaKgFallback,
    ),
    quantidadeEmbalagensRejunte: numeroNullableDaApiOuFallback(
      resultado.quantidadeEmbalagensRejunte,
      quantidadeEmbalagensRejunteFallback,
    ),
    pesoRejunteKg: numeroNullableDaApiOuFallback(
      resultado.pesoRejunteKg,
      pesoRejunteKgFallback,
    ),
    niveladoresLadoX: numeroNullableDaApiOuFallback(
      resultado.niveladoresLadoX,
      niveladoresLadoXFallback,
    ),
    niveladoresLadoY: numeroNullableDaApiOuFallback(
      resultado.niveladoresLadoY,
      niveladoresLadoYFallback,
    ),
    quantidadeNiveladores: numeroNullableDaApiOuFallback(
      resultado.quantidadeNiveladores,
      quantidadeNiveladoresFallback,
    ),
    quantidadePacotesNiveladores: numeroNullableDaApiOuFallback(
      resultado.quantidadePacotesNiveladores,
      quantidadePacotesNiveladoresFallback,
    ),
  };
}

function ResumoMetrica({
  icon,
  titulo,
  valor,
  detalhe,
}: {
  icon: ReactNode;
  titulo: string;
  valor: ReactNode;
  detalhe: ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-center gap-4 px-5 py-5">
      <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-foreground text-background">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {titulo}
        </p>
        <div className="mt-0.5 text-xl font-bold tracking-tight">{valor}</div>
        <div className="mt-0.5 truncate text-xs text-muted-foreground">
          {detalhe}
        </div>
      </div>
    </div>
  );
}

function DadoTecnico({ rotulo, valor }: { rotulo: string; valor: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-4 border-b py-2.5 last:border-b-0">
      <dt className="text-sm text-muted-foreground">{rotulo}</dt>
      <dd className="text-right text-sm font-medium">{valor}</dd>
    </div>
  );
}

export default function Calcular() {
  const { toast } = useToast();
  const calcularMutation = useCalcularPiso();

  const [codigoBusca, setCodigoBusca] = useState("");
  const [modoEntrada, setModoEntrada] = useState<ModoEntrada>("METRAGEM");
  const [metragem, setMetragem] = useState("0,00");
  const [quantidadeCaixas, setQuantidadeCaixas] = useState("");
  const [telefone, setTelefone] = useState("");
  const [resultado, setResultado] = useState<CalculoResult | null>(null);
  const [entradaCalculada, setEntradaCalculada] =
    useState<QuantidadeInformada | null>(null);
  const [opcoesCodigo, setOpcoesCodigo] = useState<Piso[]>([]);
  const [quantidadePendente, setQuantidadePendente] =
    useState<QuantidadeInformada | null>(null);
  const [buscandoCodigo, setBuscandoCodigo] = useState(false);
  const [fotoPrincipalIndisponivel, setFotoPrincipalIndisponivel] =
    useState(false);
  const [paginacaoIndisponivel, setPaginacaoIndisponivel] = useState(false);

  const piso = resultado?.piso ?? null;
  const telefoneWhatsApp = useMemo(
    () => normalizarTelefone(telefone),
    [telefone],
  );
  const resumoCalculo = useMemo(
    () => (resultado && piso ? normalizarResumoCalculo(resultado, piso) : null),
    [resultado, piso],
  );

  const fallbackFotoPrincipal = legacyProductImageFallback(
    piso?.linkFoto,
    piso?.linkFotoOrigem,
  );
  const temFotoPrincipal = Boolean(
    !fotoPrincipalIndisponivel &&
    (piso?.linkFoto?.trim() || fallbackFotoPrincipal),
  );
  const temPaginacao = Boolean(
    !paginacaoIndisponivel && piso?.linkPaginacao?.trim(),
  );
  const temImagens = temFotoPrincipal || temPaginacao;

  useEffect(() => {
    setFotoPrincipalIndisponivel(false);
    setPaginacaoIndisponivel(false);
  }, [piso?.id, piso?.linkFoto, piso?.linkFotoOrigem, piso?.linkPaginacao]);

  const executarCalculo = async (
    pisoEscolhido: Piso,
    quantidade: QuantidadeInformada,
  ) => {
    setOpcoesCodigo([]);
    setQuantidadePendente(null);

    try {
      const data = await calcularMutation.mutateAsync({
        data:
          quantidade.modo === "METRAGEM"
            ? {
                pisoId: pisoEscolhido.id,
                metragemM2: quantidade.valor,
                margemQuebra: MARGEM_QUEBRA,
              }
            : {
                pisoId: pisoEscolhido.id,
                quantidadeCaixas: quantidade.valor,
              },
      });
      setResultado(data);
      setEntradaCalculada(quantidade);
    } catch {
      toast({
        title: "Não foi possível calcular",
        description: "Confira os dados e tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleCalcular = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const codigo = codigoBusca.trim();
    if (!codigo) {
      toast({
        title: "Informe o código do piso",
        description: "Use o código ASSO ou CTC cadastrado.",
        variant: "destructive",
      });
      return;
    }

    const valorDigitado = parseNumero(
      modoEntrada === "METRAGEM" ? metragem : quantidadeCaixas,
    );
    if (
      !Number.isFinite(valorDigitado) ||
      valorDigitado <= 0 ||
      (modoEntrada === "CAIXAS" && !Number.isInteger(valorDigitado))
    ) {
      toast({
        title:
          modoEntrada === "METRAGEM"
            ? "Informe uma metragem válida"
            : "Informe uma quantidade inteira de caixas",
        description: "A quantidade precisa ser maior que zero.",
        variant: "destructive",
      });
      return;
    }

    const quantidade: QuantidadeInformada = {
      modo: modoEntrada,
      valor: valorDigitado,
    };
    if (modoEntrada === "METRAGEM") {
      setMetragem(valorDigitado.toFixed(2).replace(".", ","));
    }

    setOpcoesCodigo([]);
    setQuantidadePendente(null);
    setBuscandoCodigo(true);
    try {
      const encontrados = await listPisosByCodigo(encodeURIComponent(codigo));

      if (encontrados.length === 0) {
        throw new Error("Piso não encontrado");
      }
      if (encontrados.length > 1) {
        setOpcoesCodigo(encontrados);
        setQuantidadePendente(quantidade);
        toast({
          title: "Mais de um produto usa esse código",
          description: "Escolha o piso correto para continuar.",
        });
        return;
      }

      await executarCalculo(encontrados[0], quantidade);
    } catch {
      toast({
        title: "Piso não encontrado",
        description: "Confira o código ASSO ou CTC informado.",
        variant: "destructive",
      });
    } finally {
      setBuscandoCodigo(false);
    }
  };

  const handleWhatsApp = () => {
    if (!resultado || !piso || !resumoCalculo || !telefoneWhatsApp) return;

    const linhas = [
      "Olá! Segue o cálculo do piso:",
      "",
      `Produto: ${piso.nome}`,
      `ASSO: ${piso.codigoRede ?? "—"}`,
      `CTC: ${piso.codigoLoja ?? "—"}`,
      entradaCalculada?.modo === "CAIXAS"
        ? `Quantidade solicitada: ${resultado.quantidadeCaixas} caixas`
        : `Área solicitada: ${formatarMetragem(resultado.metragemM2)}`,
      `Área vendida: ${formatarMetragem(resumoCalculo.metragemVendidaM2)}`,
      `Argamassa: ${resumoCalculo.quantidadeSacosArgamassa} sacos`,
      resumoCalculo.quantidadeEmbalagensRejunte === null
        ? "Rejunte: não calculado"
        : `Rejunte: ${resumoCalculo.quantidadeEmbalagensRejunte} embalagens`,
      resumoCalculo.quantidadeNiveladores === null
        ? "Niveladores: não calculados"
        : `Niveladores: ${resumoCalculo.quantidadeNiveladores} peças (${resumoCalculo.quantidadePacotesNiveladores} pacotes)`,
      numeroFinito(resultado.valorTotal)
        ? `Valor do piso: ${formatadorMoeda.format(resultado.valorTotal)}`
        : "Valor do piso: preço não informado",
    ];

    window.open(
      `https://wa.me/${telefoneWhatsApp}?text=${encodeURIComponent(linhas.join("\n"))}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  const calculando = buscandoCodigo || calcularMutation.isPending;
  const quantidadeAtual =
    modoEntrada === "METRAGEM" ? metragem : quantidadeCaixas;

  return (
    <Layout>
      <div className="mx-auto w-full max-w-[1560px] space-y-4 p-4 sm:p-6 lg:p-8">
        <header>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Calcular piso
          </h1>
          <p className="mt-1 text-muted-foreground">
            Consulte o produto e informe a quantidade desejada.
          </p>
        </header>

        <Card className="shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <form
              onSubmit={handleCalcular}
              className="grid items-end gap-4 lg:grid-cols-[minmax(260px,1.4fr)_minmax(250px,0.8fr)_minmax(190px,0.7fr)_220px]"
            >
              <div className="space-y-2">
                <Label htmlFor="codigo-piso">Código do piso</Label>
                <div className="relative">
                  <Input
                    id="codigo-piso"
                    value={codigoBusca}
                    onChange={(event) => setCodigoBusca(event.target.value)}
                    placeholder="Digite o código ASSO ou CTC"
                    autoComplete="off"
                    className="h-11 pr-10"
                  />
                  <Search className="pointer-events-none absolute right-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Calcular por</Label>
                <Tabs
                  value={modoEntrada}
                  onValueChange={(valor) =>
                    setModoEntrada(valor as ModoEntrada)
                  }
                >
                  <TabsList className="grid h-11 w-full grid-cols-2">
                    <TabsTrigger value="METRAGEM" className="h-9">
                      Por m²
                    </TabsTrigger>
                    <TabsTrigger value="CAIXAS" className="h-9">
                      Por caixas
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <div className="space-y-2">
                <Label htmlFor="quantidade-calculo">Quantidade</Label>
                <div className="relative">
                  <Input
                    id="quantidade-calculo"
                    value={quantidadeAtual}
                    onChange={(event) => {
                      if (modoEntrada === "METRAGEM") {
                        const input = event.currentTarget;
                        setMetragem(mascararEntradaMetragem(input.value));
                        requestAnimationFrame(() =>
                          posicionarCursorNoFim(input),
                        );
                        return;
                      }
                      setQuantidadeCaixas(
                        event.target.value.replace(/\D/g, ""),
                      );
                    }}
                    onFocus={(event) => {
                      if (modoEntrada === "METRAGEM") {
                        posicionarCursorNoFim(event.currentTarget);
                      }
                    }}
                    onClick={(event) => {
                      if (modoEntrada === "METRAGEM") {
                        posicionarCursorNoFim(event.currentTarget);
                      }
                    }}
                    inputMode={
                      modoEntrada === "METRAGEM" ? "decimal" : "numeric"
                    }
                    className="h-11 pr-16 text-right tabular-nums"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
                    {modoEntrada === "METRAGEM" ? "m²" : "caixas"}
                  </span>
                </div>
              </div>

              <Button type="submit" className="h-11" disabled={calculando}>
                {calculando ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Calculator className="mr-2 size-4" />
                )}
                {calculando ? "Calculando..." : "Calcular"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {opcoesCodigo.length > 1 && quantidadePendente && (
          <Alert className="border-amber-300 bg-amber-50 text-amber-950">
            <Info className="size-4" />
            <AlertTitle>Código encontrado em mais de um produto</AlertTitle>
            <AlertDescription>
              <p className="mb-3">
                Selecione qual piso deve ser usado neste cálculo.
              </p>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {opcoesCodigo.map((opcao) => (
                  <button
                    key={opcao.id}
                    type="button"
                    className="rounded-lg border border-amber-200 bg-background p-3 text-left transition-colors hover:border-amber-500 hover:bg-amber-100/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600"
                    onClick={() =>
                      void executarCalculo(opcao, quantidadePendente)
                    }
                  >
                    <span className="block font-semibold">{opcao.nome}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      ASSO: {opcao.codigoRede ?? "—"} · CTC:{" "}
                      {opcao.codigoLoja ?? "—"}
                    </span>
                  </button>
                ))}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {!resultado || !piso || !resumoCalculo ? (
          <Card className="shadow-sm">
            <Empty className="min-h-[360px]">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Calculator />
                </EmptyMedia>
                <EmptyTitle>Seu cálculo aparecerá aqui</EmptyTitle>
                <EmptyDescription>
                  Informe um código e escolha entre metragem ou quantidade de
                  caixas para consultar o piso.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </Card>
        ) : (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
            <Card className="shadow-sm">
              <CardContent className="flex flex-col gap-5 p-4 sm:p-5 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex min-w-0 items-center gap-4">
                  <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-muted/50">
                    {temFotoPrincipal ? (
                      <PisoImage
                        primaryUrl={piso.linkFoto}
                        fallbackUrl={fallbackFotoPrincipal}
                        alt={piso.nome}
                        className="size-full object-contain"
                        fallbackClassName="size-full rounded-none"
                      />
                    ) : (
                      <Package className="size-7 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-xl font-bold tracking-tight sm:text-2xl">
                        {piso.nome}
                      </h2>
                      <Badge
                        variant="outline"
                        className={cn(
                          "gap-1.5",
                          piso.ativo
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-zinc-200 bg-zinc-100 text-zinc-600",
                        )}
                      >
                        <span
                          className={cn(
                            "size-2 rounded-full",
                            piso.ativo ? "bg-emerald-500" : "bg-zinc-400",
                          )}
                        />
                        {piso.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
                      <span>
                        ASSO{" "}
                        <strong className="text-foreground">
                          {piso.codigoRede ?? "—"}
                        </strong>
                      </span>
                      <span>
                        CTC{" "}
                        <strong className="text-foreground">
                          {piso.codigoLoja ?? "—"}
                        </strong>
                      </span>
                      <span>
                        Formato{" "}
                        <strong className="text-foreground">
                          {piso.largura && piso.altura
                            ? `${formatarNumero(piso.largura)} × ${formatarNumero(piso.altura)} cm`
                            : "—"}
                        </strong>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-x-8 gap-y-3 xl:shrink-0">
                  <div>
                    <p className="text-xs text-muted-foreground">Estoque</p>
                    <p className="font-semibold">
                      {formatarMetragem(piso.estoqueM2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Valor/m²</p>
                    <p className="font-semibold">
                      {piso.valor > 0
                        ? formatadorMoeda.format(piso.valor)
                        : "Não informado"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {temImagens && (
              <div
                className={cn(
                  "grid gap-4",
                  temFotoPrincipal && temPaginacao && "lg:grid-cols-2",
                )}
              >
                {temFotoPrincipal && (
                  <Card className="overflow-hidden shadow-sm">
                    <CardHeader className="px-4 py-3">
                      <CardTitle className="flex items-center gap-2 text-sm">
                        <ImageIcon className="size-4" />
                        Foto do piso
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="border-t p-2">
                      <PisoImage
                        primaryUrl={piso.linkFoto}
                        fallbackUrl={fallbackFotoPrincipal}
                        alt={`Foto do piso ${piso.nome}`}
                        className="h-[300px] w-full rounded-md bg-muted/20 object-contain"
                        fallbackClassName="min-h-[300px]"
                        onUnavailable={() => setFotoPrincipalIndisponivel(true)}
                      />
                    </CardContent>
                  </Card>
                )}

                {temPaginacao && (
                  <Card className="overflow-hidden shadow-sm">
                    <CardHeader className="px-4 py-3">
                      <CardTitle className="flex items-center gap-2 text-sm">
                        <ImageIcon className="size-4" />
                        Paginação/Ambiente
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="border-t p-2">
                      <PisoImage
                        primaryUrl={piso.linkPaginacao}
                        alt={`Paginação ou ambiente de ${piso.nome}`}
                        className="h-[300px] w-full rounded-md bg-muted/20 object-contain"
                        fallbackClassName="min-h-[300px]"
                        onUnavailable={() => setPaginacaoIndisponivel(true)}
                      />
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            <Card className="overflow-hidden shadow-sm">
              <CardContent className="grid p-0 sm:grid-cols-2 xl:grid-cols-4 xl:divide-x">
                <ResumoMetrica
                  icon={<Package className="size-5" />}
                  titulo="Piso"
                  valor={`${resultado.quantidadeCaixas} ${resultado.quantidadeCaixas === 1 ? "caixa" : "caixas"}`}
                  detalhe={`Cobre ${formatarMetragem(resumoCalculo.metragemVendidaM2)}`}
                />
                <ResumoMetrica
                  icon={<Layers className="size-5" />}
                  titulo="Argamassa"
                  valor={`${resumoCalculo.quantidadeSacosArgamassa} ${resumoCalculo.quantidadeSacosArgamassa === 1 ? "saco" : "sacos"}`}
                  detalhe={`${formatarNumero(resumoCalculo.pesoArgamassaKg)} kg de consumo teórico`}
                />
                <ResumoMetrica
                  icon={<ShoppingCart className="size-5" />}
                  titulo="Rejunte"
                  valor={
                    resumoCalculo.quantidadeEmbalagensRejunte === null
                      ? "Não calculado"
                      : `${resumoCalculo.quantidadeEmbalagensRejunte} ${resumoCalculo.quantidadeEmbalagensRejunte === 1 ? "embalagem" : "embalagens"}`
                  }
                  detalhe={
                    resumoCalculo.pesoRejunteKg === null
                      ? "Cadastre formato e junta"
                      : `${formatarNumero(resumoCalculo.pesoRejunteKg)} kg de consumo teórico`
                  }
                />
                <ResumoMetrica
                  icon={<Ruler className="size-5" />}
                  titulo="Niveladores"
                  valor={
                    resumoCalculo.quantidadeNiveladores === null
                      ? "Não calculado"
                      : `${resumoCalculo.quantidadeNiveladores} peças`
                  }
                  detalhe={
                    resumoCalculo.quantidadePacotesNiveladores === null
                      ? "Cadastre largura e altura"
                      : `${resumoCalculo.quantidadePacotesNiveladores} ${resumoCalculo.quantidadePacotesNiveladores === 1 ? "pacote" : "pacotes"} de 100 pçs`
                  }
                />
              </CardContent>
            </Card>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)]">
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle>Dados técnicos e cálculo</CardTitle>
                  <CardDescription>
                    Quantidades calculadas sobre as caixas efetivamente
                    vendidas.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <dl className="grid gap-x-8 md:grid-cols-2">
                    <div>
                      <DadoTecnico
                        rotulo="Formato"
                        valor={
                          piso.largura && piso.altura
                            ? `${formatarNumero(piso.largura)} × ${formatarNumero(piso.altura)} cm`
                            : "Não informado"
                        }
                      />
                      <DadoTecnico
                        rotulo="Tipo de piso"
                        valor={piso.tipoPiso || "Não informado"}
                      />
                      <DadoTecnico
                        rotulo="Classificação"
                        valor={piso.classificacaoUso || "Não informada"}
                      />
                      <DadoTecnico
                        rotulo="Acabamento das bordas"
                        valor={acabamento(piso)}
                      />
                      <DadoTecnico
                        rotulo="Junta"
                        valor={
                          piso.rejunte
                            ? `${formatarNumero(piso.rejunte)} mm`
                            : "Não informada"
                        }
                      />
                      <DadoTecnico
                        rotulo="Peças por caixa"
                        valor={piso.pecasPorCaixa ?? "Não informado"}
                      />
                    </div>
                    <div>
                      <DadoTecnico
                        rotulo="Área por caixa"
                        valor={formatarMetragem(piso.m2PorCaixa)}
                      />
                      <DadoTecnico
                        rotulo={
                          entradaCalculada?.modo === "CAIXAS"
                            ? "Caixas solicitadas"
                            : "Área solicitada"
                        }
                        valor={
                          entradaCalculada?.modo === "CAIXAS"
                            ? resultado.quantidadeCaixas
                            : formatarMetragem(resultado.metragemM2)
                        }
                      />
                      <DadoTecnico
                        rotulo="Margem aplicada"
                        valor={`${formatarNumero(resultado.margemQuebra)}%`}
                      />
                      <DadoTecnico
                        rotulo="Área após margem"
                        valor={formatarMetragem(resultado.metragemComMargem)}
                      />
                      <DadoTecnico
                        rotulo="Área efetivamente vendida"
                        valor={formatarMetragem(
                          resumoCalculo.metragemVendidaM2,
                        )}
                      />
                      <DadoTecnico
                        rotulo={
                          piso.ativo
                            ? "Estoque atual"
                            : "Último estoque conhecido"
                        }
                        valor={formatarMetragem(piso.estoqueM2)}
                      />
                    </div>
                  </dl>

                  {piso.localDeUso && (
                    <div className="mt-5 rounded-xl border bg-muted/30 p-4">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Local de uso
                      </p>
                      <p className="mt-1 text-sm leading-relaxed">
                        {piso.localDeUso}
                      </p>
                    </div>
                  )}

                  {piso.linkSite && (
                    <Button asChild variant="outline" className="mt-4">
                      <a
                        href={piso.linkSite}
                        target="_blank"
                        rel="noreferrer noopener"
                      >
                        <ExternalLink className="mr-2 size-4" />
                        Abrir site do piso
                      </a>
                    </Button>
                  )}
                </CardContent>
              </Card>

              <Card className="overflow-hidden shadow-sm">
                <section className="p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-semibold">
                        Niveladores de piso
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Recomendação calculada conforme o formato da peça.
                      </p>
                    </div>
                    {resumoCalculo.quantidadeNiveladores !== null && (
                      <Badge
                        variant="outline"
                        className="border-emerald-200 bg-emerald-50 text-emerald-700"
                      >
                        <CheckCircle2 className="mr-1 size-3.5" />
                        Calculado
                      </Badge>
                    )}
                  </div>

                  <div className="mt-4 overflow-hidden rounded-xl border bg-white">
                    <img
                      src="/images/niveladores-cortag.png"
                      alt="Exemplo de posicionamento dos niveladores nos lados X e Y de um piso"
                      className="mx-auto h-[220px] w-full object-contain p-3"
                      loading="lazy"
                    />
                  </div>

                  {(resumoCalculo.niveladoresLadoX !== null ||
                    resumoCalculo.niveladoresLadoY !== null) && (
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      {resumoCalculo.niveladoresLadoX !== null &&
                        piso.largura != null && (
                          <div className="rounded-lg border bg-muted/30 px-3 py-2.5">
                            <p className="text-xs font-medium text-muted-foreground">
                              Comprimento X
                            </p>
                            <div className="mt-1 flex items-end justify-between gap-2">
                              <strong className="text-sm">
                                {formatarNumero(piso.largura)} cm
                              </strong>
                              <span className="text-right text-xs text-muted-foreground">
                                Recomendado: {resumoCalculo.niveladoresLadoX}{" "}
                                pçs
                              </span>
                            </div>
                          </div>
                        )}
                      {resumoCalculo.niveladoresLadoY !== null &&
                        piso.altura != null && (
                          <div className="rounded-lg border bg-muted/30 px-3 py-2.5">
                            <p className="text-xs font-medium text-muted-foreground">
                              Largura Y
                            </p>
                            <div className="mt-1 flex items-end justify-between gap-2">
                              <strong className="text-sm">
                                {formatarNumero(piso.altura)} cm
                              </strong>
                              <span className="text-right text-xs text-muted-foreground">
                                Recomendado: {resumoCalculo.niveladoresLadoY}{" "}
                                pçs
                              </span>
                            </div>
                          </div>
                        )}
                    </div>
                  )}
                </section>

                <section className="border-t p-5 sm:p-6">
                  <h3 className="text-lg font-semibold">
                    Compartilhar cálculo
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Envie este resultado ao cliente pelo WhatsApp.
                  </p>

                  <div className="mt-4 space-y-2">
                    <Label htmlFor="telefone-cliente">
                      Telefone do cliente
                    </Label>
                    <Input
                      id="telefone-cliente"
                      type="tel"
                      inputMode="tel"
                      value={telefone}
                      onChange={(event) =>
                        setTelefone(mascararTelefone(event.target.value))
                      }
                      onPaste={(event) => {
                        event.preventDefault();
                        setTelefone(
                          mascararTelefone(event.clipboardData.getData("text")),
                        );
                      }}
                      placeholder="(00) 00000-0000"
                      autoComplete="tel-national"
                      className="h-11"
                    />
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <Button
                      type="button"
                      className="h-11 bg-emerald-600 text-white hover:bg-emerald-700"
                      onClick={handleWhatsApp}
                      disabled={!telefoneWhatsApp}
                    >
                      <MessageCircle className="mr-2 size-4" />
                      WhatsApp
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11"
                      disabled
                    >
                      <ShoppingCart className="mr-2 size-4" />
                      Orçamento · em breve
                    </Button>
                  </div>
                </section>
              </Card>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
