import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Layout } from "@/components/layout/Layout";
import {
  useListPisos,
  useCreatePiso,
  useUpdatePiso,
  useDeletePiso,
  getListPisosQueryKey,
  ApiError,
  customFetch,
  type Piso,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent } from "@/components/ui/card";
import {
  PisoImage,
  legacyProductImageFallback,
} from "@/components/catalogo/PisoImage";
import { useToast } from "@/hooks/use-toast";
import {
  Save,
  Edit,
  Trash2,
  Search,
  Printer,
  X,
  Plus,
  Upload,
  Loader2,
  Eraser,
  ExternalLink,
  Eye,
} from "lucide-react";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);
const USAGE_DESCRIPTION: Partial<
  Record<"LA" | "LB" | "LC" | "LD" | "LE" | "LF", string>
> = {
  LA: "Paredes residenciais e comerciais internas e externas até 3 metros de altura",
  LB: "Ambientes residenciais sem acesso para a rua, como banheiros, salas, quartos e cozinhas",
  LC: "Ambientes comerciais e residências internos, sem acesso a áreas externas e de equipamentos",
  LD: "Indicado para uso como piso em todos os ambientes residenciais",
  LE: "Todos os ambientes residenciais e comerciais externos",
};

type ProductImageUploadResponse = { url: string };

function errorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return fallback;
  if (!error.data || typeof error.data !== "object") return error.message;

  const data = error.data as Record<string, unknown>;
  for (const field of ["detail", "error", "message", "title"]) {
    if (typeof data[field] === "string" && data[field].trim()) {
      return data[field];
    }
  }
  return error.message;
}

function isManagedProductImage(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    return new URL(url, window.location.origin).pathname.startsWith(
      "/product-images/",
    );
  } catch {
    return false;
  }
}

async function uploadProductImage(
  file: File,
): Promise<ProductImageUploadResponse> {
  const body = new FormData();
  body.append("file", file);
  return customFetch<ProductImageUploadResponse>("/api/product-images", {
    method: "POST",
    body,
    responseType: "json",
  });
}

async function deleteProductImage(url: string): Promise<void> {
  await customFetch<void>("/api/product-images", {
    method: "DELETE",
    body: JSON.stringify({ url }),
  });
}

const pisoSchema = z
  .object({
    nome: z.string().min(1, "Nome é obrigatório"),
    codigoRede: z.string().optional(),
    codigoLoja: z.string().optional(),
    largura: z.coerce.number().optional(),
    altura: z.coerce.number().optional(),
    rejunte: z.coerce.number().optional(),
    pecasPorCaixa: z.coerce.number().optional(),
    m2PorCaixa: z.coerce.number().min(0.01, "M²/Caixa é obrigatório"),
    localDeUso: z.string().optional(),
    tipoPiso: z.string().optional(),
    classificacaoUso: z.enum(["LA", "LB", "LC", "LD", "LE", "LF"]).optional(),
    acabamentoBordas: z.enum(["RETIFICADO", "BOLD"]),
    linkSite: z.string().optional(),
    linkFoto: z.string().optional(),
    linkFotoOrigem: z.string().optional(),
    linkPaginacao: z.string().optional(),
    linkAreaCentral: z.string().optional(),
    valor: z.coerce.number().min(0).optional(),
    estoqueM2: z.coerce.number().min(0).optional(),
    ativo: z.boolean(),
  })
  .superRefine((data, context) => {
    if (!data.codigoRede?.trim() && !data.codigoLoja?.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Informe ao menos o código ASSO ou CTC",
        path: ["codigoRede"],
      });
    }
  });

type PisoFormValues = z.infer<typeof pisoSchema>;

export default function Cadastro() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [search, setSearch] = useState("");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isViewing, setIsViewing] = useState(false);
  const [selectedPiso, setSelectedPiso] = useState<Piso | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [temporaryUploadedImage, setTemporaryUploadedImage] = useState<
    string | null
  >(null);
  const [isUploadingPaginationImage, setIsUploadingPaginationImage] =
    useState(false);
  const [
    temporaryUploadedPaginationImage,
    setTemporaryUploadedPaginationImage,
  ] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const paginationImageInputRef = useRef<HTMLInputElement>(null);
  const pageTopRef = useRef<HTMLDivElement>(null);

  const scrollToPageTop = () => {
    requestAnimationFrame(() => {
      pageTopRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  };

  const { data: pisos, isLoading } = useListPisos({
    search: search || undefined,
  });

  const createPiso = useCreatePiso();
  const updatePiso = useUpdatePiso();
  const deletePiso = useDeletePiso();

  const form = useForm<PisoFormValues>({
    resolver: zodResolver(pisoSchema),
    defaultValues: {
      nome: "",
      codigoRede: "",
      codigoLoja: "",
      largura: undefined,
      altura: undefined,
      rejunte: 2,
      pecasPorCaixa: undefined,
      m2PorCaixa: 0,
      localDeUso: USAGE_DESCRIPTION.LA,
      tipoPiso: "",
      classificacaoUso: "LA",
      acabamentoBordas: "RETIFICADO",
      linkSite: "",
      linkFoto: "",
      linkFotoOrigem: "",
      linkPaginacao: "",
      linkAreaCentral: "",
      valor: 0,
      estoqueM2: 0,
      ativo: false,
    },
  });

  const linkFotoValue = form.watch("linkFoto");
  const linkFotoOrigemValue = form.watch("linkFotoOrigem");
  const linkPaginacaoValue = form.watch("linkPaginacao");
  const linkSiteValue = form.watch("linkSite");
  const larguraValue = form.watch("largura");
  const alturaValue = form.watch("altura");
  const m2PorCaixaValue = form.watch("m2PorCaixa");

  useEffect(() => {
    if (!isEditing) return;

    const largura = Number(larguraValue);
    const altura = Number(alturaValue);
    const m2PorCaixa = Number(m2PorCaixaValue);
    if (largura > 0 && altura > 0 && m2PorCaixa > 0) {
      const areaPeca = (largura / 100) * (altura / 100);
      form.setValue("pecasPorCaixa", Math.round(m2PorCaixa / areaPeca), {
        shouldDirty: true,
        shouldValidate: true,
      });
    } else if (form.getValues("pecasPorCaixa") !== undefined) {
      form.setValue("pecasPorCaixa", undefined, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  }, [alturaValue, form, isEditing, larguraValue, m2PorCaixaValue]);

  const handleSelectPiso = (piso: Piso, preserveUploadedImage = false) => {
    if (temporaryUploadedImage && !preserveUploadedImage) {
      void deleteProductImage(temporaryUploadedImage).catch(() => undefined);
    }
    if (temporaryUploadedPaginationImage && !preserveUploadedImage) {
      void deleteProductImage(temporaryUploadedPaginationImage).catch(
        () => undefined,
      );
    }
    setTemporaryUploadedImage(null);
    setTemporaryUploadedPaginationImage(null);
    setSelectedPiso(piso);
    setEditingId(piso.id);
    setIsEditing(false);
    setIsViewing(false);
    form.reset({
      nome: piso.nome,
      codigoRede: piso.codigoRede || "",
      codigoLoja: piso.codigoLoja || "",
      largura: piso.largura || undefined,
      altura: piso.altura || undefined,
      rejunte: piso.rejunte || undefined,
      pecasPorCaixa: piso.pecasPorCaixa || undefined,
      m2PorCaixa: piso.m2PorCaixa,
      localDeUso: piso.localDeUso || "",
      tipoPiso: piso.tipoPiso || "",
      classificacaoUso: piso.classificacaoUso || undefined,
      acabamentoBordas: piso.acabamentoBordas,
      linkSite: piso.linkSite || "",
      linkFoto: piso.linkFoto || "",
      linkFotoOrigem: piso.linkFotoOrigem || "",
      linkPaginacao: piso.linkPaginacao || "",
      linkAreaCentral: piso.linkAreaCentral || "",
      valor: piso.valor,
      estoqueM2: piso.estoqueM2,
      ativo: piso.ativo,
    });
  };

  const handleNew = () => {
    if (temporaryUploadedImage) {
      void deleteProductImage(temporaryUploadedImage).catch(() => undefined);
    }
    if (temporaryUploadedPaginationImage) {
      void deleteProductImage(temporaryUploadedPaginationImage).catch(
        () => undefined,
      );
    }
    setTemporaryUploadedImage(null);
    setTemporaryUploadedPaginationImage(null);
    setEditingId(null);
    setSelectedPiso(null);
    setIsEditing(true);
    setIsViewing(false);
    form.reset({
      nome: "",
      codigoRede: "",
      codigoLoja: "",
      largura: undefined,
      altura: undefined,
      rejunte: 2,
      pecasPorCaixa: undefined,
      m2PorCaixa: 0,
      localDeUso: USAGE_DESCRIPTION.LA,
      tipoPiso: "",
      classificacaoUso: "LA",
      acabamentoBordas: "RETIFICADO",
      linkSite: "",
      linkFoto: "",
      linkFotoOrigem: "",
      linkPaginacao: "",
      linkAreaCentral: "",
      valor: 0,
      estoqueM2: 0,
      ativo: false,
    });
    scrollToPageTop();
  };

  const handleEdit = () => {
    scrollToPageTop();
    if (editingId) {
      setIsEditing(true);
      setIsViewing(false);
    } else {
      toast({
        title: "Aviso",
        description: "Selecione um piso na tabela para alterar.",
      });
    }
  };

  const handleView = () => {
    scrollToPageTop();
    if (editingId) {
      setIsEditing(false);
      setIsViewing(true);
    } else {
      toast({
        title: "Aviso",
        description: "Selecione um piso na tabela para visualizar.",
      });
    }
  };

  const handleDelete = () => {
    scrollToPageTop();
    if (!editingId) {
      toast({ title: "Aviso", description: "Selecione um piso para excluir." });
      return;
    }
    if (window.confirm("Tem certeza que deseja excluir este piso?")) {
      deletePiso.mutate(
        { id: editingId },
        {
          onSuccess: () => {
            const deletedImages = [
              selectedPiso?.linkFoto,
              selectedPiso?.linkPaginacao,
            ].filter(
              (image): image is string =>
                Boolean(image) && isManagedProductImage(image),
            );
            deletedImages.forEach((image) => {
              void deleteProductImage(image).catch(() => undefined);
            });
            if (
              temporaryUploadedImage &&
              !deletedImages.includes(temporaryUploadedImage)
            ) {
              void deleteProductImage(temporaryUploadedImage).catch(
                () => undefined,
              );
            }
            if (
              temporaryUploadedPaginationImage &&
              !deletedImages.includes(temporaryUploadedPaginationImage)
            ) {
              void deleteProductImage(temporaryUploadedPaginationImage).catch(
                () => undefined,
              );
            }
            setTemporaryUploadedImage(null);
            setTemporaryUploadedPaginationImage(null);
            queryClient.invalidateQueries({ queryKey: getListPisosQueryKey() });
            toast({
              title: "Piso excluído",
              description: "O registro foi removido com sucesso.",
            });
            setEditingId(null);
            setSelectedPiso(null);
            setIsEditing(false);
            setIsViewing(false);
          },
          onError: (error) => {
            toast({
              title: "Erro",
              description: errorMessage(
                error,
                "Não foi possível excluir o piso.",
              ),
              variant: "destructive",
            });
          },
        },
      );
    }
  };

  const handleLimpar = () => {
    handleNew();
  };

  const handleOpenProductSite = () => {
    const value = linkSiteValue?.trim();
    if (!value) return;

    try {
      const siteUrl = new URL(value);
      if (siteUrl.protocol !== "http:" && siteUrl.protocol !== "https:") {
        throw new Error("Protocolo não permitido");
      }
      window.open(siteUrl.href, "_blank", "noopener,noreferrer");
    } catch {
      toast({
        title: "Link inválido",
        description:
          "Informe um endereço completo iniciado por http:// ou https://.",
        variant: "destructive",
      });
    }
  };

  const handleClassificationChange = (
    value: NonNullable<PisoFormValues["classificacaoUso"]>,
  ) => {
    form.setValue("classificacaoUso", value, {
      shouldDirty: true,
      shouldValidate: true,
    });
    form.setValue("localDeUso", USAGE_DESCRIPTION[value] ?? "", {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  const handleBorderFinishChange = (
    value: PisoFormValues["acabamentoBordas"],
  ) => {
    form.setValue("acabamentoBordas", value, {
      shouldDirty: true,
      shouldValidate: true,
    });
    form.setValue("rejunte", value === "RETIFICADO" ? 2 : 5, {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  const handleGroutChange = (value: string) => {
    const grout = Number(value);
    form.setValue("rejunte", grout, {
      shouldDirty: true,
      shouldValidate: true,
    });
    if (grout <= 2) {
      form.setValue("acabamentoBordas", "RETIFICADO", {
        shouldDirty: true,
        shouldValidate: true,
      });
    } else if (grout === 5) {
      form.setValue("acabamentoBordas", "BOLD", {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  };

  const handleImageUpload = async (
    event: ChangeEvent<HTMLInputElement>,
    field: "linkFoto" | "linkPaginacao",
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
      toast({
        title: "Formato inválido",
        description: "Use uma imagem JPG, PNG, WebP ou AVIF.",
        variant: "destructive",
      });
      return;
    }
    if (file.size === 0 || file.size > MAX_IMAGE_BYTES) {
      toast({
        title: "Imagem muito grande",
        description: "A imagem deve ter no máximo 5 MB.",
        variant: "destructive",
      });
      return;
    }

    const isPagination = field === "linkPaginacao";
    const previousTemporaryImage = isPagination
      ? temporaryUploadedPaginationImage
      : temporaryUploadedImage;
    if (isPagination) {
      setIsUploadingPaginationImage(true);
    } else {
      setIsUploadingImage(true);
    }
    try {
      const uploaded = await uploadProductImage(file);
      if (previousTemporaryImage && previousTemporaryImage !== uploaded.url) {
        void deleteProductImage(previousTemporaryImage).catch(() => undefined);
      }
      if (isPagination) {
        setTemporaryUploadedPaginationImage(uploaded.url);
      } else {
        setTemporaryUploadedImage(uploaded.url);
      }
      form.setValue(field, uploaded.url, {
        shouldDirty: true,
        shouldValidate: true,
      });
      toast({
        title: "Imagem enviada",
        description: isPagination
          ? "Clique em Salvar para associar a Paginação/Ambiente ao piso."
          : "Clique em Salvar para associá-la ao piso.",
      });
    } catch (error) {
      toast({
        title: "Erro ao enviar imagem",
        description: errorMessage(error, "Não foi possível enviar a imagem."),
        variant: "destructive",
      });
    } finally {
      if (isPagination) {
        setIsUploadingPaginationImage(false);
      } else {
        setIsUploadingImage(false);
      }
    }
  };

  const handleFloorImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
    void handleImageUpload(event, "linkFoto");
  };

  const handlePaginationImageUpload = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    void handleImageUpload(event, "linkPaginacao");
  };

  const handleRemoveImage = () => {
    if (temporaryUploadedImage) {
      void deleteProductImage(temporaryUploadedImage).catch(() => undefined);
      setTemporaryUploadedImage(null);
    }
    form.setValue("linkFoto", "", {
      shouldDirty: true,
      shouldValidate: true,
    });
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const handleRemovePaginationImage = () => {
    if (temporaryUploadedPaginationImage) {
      void deleteProductImage(temporaryUploadedPaginationImage).catch(
        () => undefined,
      );
      setTemporaryUploadedPaginationImage(null);
    }
    form.setValue("linkPaginacao", "", {
      shouldDirty: true,
      shouldValidate: true,
    });
    if (paginationImageInputRef.current) {
      paginationImageInputRef.current.value = "";
    }
  };

  const onInvalid = () => {
    toast({
      title: "Revise os dados do piso",
      description:
        "Há campos obrigatórios ou valores inválidos destacados no formulário.",
      variant: "destructive",
    });
  };

  const onSubmit = (data: PisoFormValues) => {
    const payload = {
      ...data,
      codigoRede: data.codigoRede || undefined,
      codigoLoja: data.codigoLoja || undefined,
      localDeUso: data.localDeUso || undefined,
      tipoPiso: data.tipoPiso || undefined,
      linkSite: data.linkSite || undefined,
      linkFoto: data.linkFoto,
      linkFotoOrigem: data.linkFotoOrigem || undefined,
      linkPaginacao: data.linkPaginacao,
      linkAreaCentral: data.linkAreaCentral || undefined,
    };

    if (editingId) {
      updatePiso.mutate(
        { id: editingId, data: payload },
        {
          onSuccess: (pisoAtualizado) => {
            const previousImage = selectedPiso?.linkFoto;
            const previousPaginationImage = selectedPiso?.linkPaginacao;
            if (
              previousImage &&
              previousImage !== pisoAtualizado.linkFoto &&
              isManagedProductImage(previousImage)
            ) {
              void deleteProductImage(previousImage).catch(() => undefined);
            }
            if (
              previousPaginationImage &&
              previousPaginationImage !== pisoAtualizado.linkPaginacao &&
              isManagedProductImage(previousPaginationImage)
            ) {
              void deleteProductImage(previousPaginationImage).catch(
                () => undefined,
              );
            }
            if (
              temporaryUploadedImage &&
              temporaryUploadedImage !== pisoAtualizado.linkFoto
            ) {
              void deleteProductImage(temporaryUploadedImage).catch(
                () => undefined,
              );
            }
            if (
              temporaryUploadedPaginationImage &&
              temporaryUploadedPaginationImage !== pisoAtualizado.linkPaginacao
            ) {
              void deleteProductImage(temporaryUploadedPaginationImage).catch(
                () => undefined,
              );
            }
            setTemporaryUploadedImage(null);
            setTemporaryUploadedPaginationImage(null);
            queryClient.invalidateQueries({ queryKey: getListPisosQueryKey() });
            setSelectedPiso(pisoAtualizado);
            setIsEditing(false);
            setIsViewing(false);
            toast({
              title: "Sucesso",
              description: "Piso atualizado com sucesso.",
            });
          },
          onError: (error) => {
            toast({
              title: "Erro",
              description: errorMessage(error, "Não foi possível atualizar."),
              variant: "destructive",
            });
          },
        },
      );
    } else {
      createPiso.mutate(
        { data: payload },
        {
          onSuccess: (pisoCriado) => {
            if (
              temporaryUploadedImage &&
              temporaryUploadedImage !== pisoCriado.linkFoto
            ) {
              void deleteProductImage(temporaryUploadedImage).catch(
                () => undefined,
              );
            }
            if (
              temporaryUploadedPaginationImage &&
              temporaryUploadedPaginationImage !== pisoCriado.linkPaginacao
            ) {
              void deleteProductImage(temporaryUploadedPaginationImage).catch(
                () => undefined,
              );
            }
            setTemporaryUploadedImage(null);
            setTemporaryUploadedPaginationImage(null);
            queryClient.invalidateQueries({ queryKey: getListPisosQueryKey() });
            handleSelectPiso(pisoCriado, true);
            toast({ title: "Sucesso", description: "Novo piso cadastrado." });
          },
          onError: (error) => {
            toast({
              title: "Erro",
              description: errorMessage(error, "Não foi possível cadastrar."),
              variant: "destructive",
            });
          },
        },
      );
    }
  };

  return (
    <Layout>
      <div ref={pageTopRef} className="flex-1 space-y-6 p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Cadastro de Piso
          </h1>
          <p className="text-gray-600">
            Adicione ou edite informações de pisos cerâmicos e porcelanatos
          </p>
        </div>

        {isEditing || isViewing ? (
          <Card className="border-none shadow-lg">
            <CardContent className="p-8">
              {isViewing && (
                <div className="mb-6 flex items-center gap-2 rounded-md border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                  <Eye size={17} />
                  Modo de visualização: os dados deste piso não podem ser
                  alterados.
                </div>
              )}
              <Form {...form}>
                <form
                  noValidate
                  onSubmit={form.handleSubmit(onSubmit, onInvalid)}
                >
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-6">
                      <div>
                        <FormField
                          control={form.control}
                          name="nome"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Nome do Piso *</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="Ex: Porcelanato Marmorizado"
                                  disabled={!isEditing}
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div>
                        <FormField
                          control={form.control}
                          name="codigoRede"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Código Asso</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="Ex: ASS-001"
                                  disabled={!isEditing}
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="codigoLoja"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Código Loja</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="Ex: 10567"
                                  disabled={!isEditing}
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="largura"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Largura (cm)</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  step="0.01"
                                  placeholder="Ex: 60"
                                  disabled={!isEditing}
                                  {...field}
                                  value={field.value ?? ""}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="altura"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Altura (cm)</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  step="0.01"
                                  placeholder="Ex: 60"
                                  disabled={!isEditing}
                                  {...field}
                                  value={field.value ?? ""}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="rejunte"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Rejunte (mm)</FormLabel>
                              <Select
                                disabled={!isEditing}
                                onValueChange={handleGroutChange}
                                value={
                                  field.value == null
                                    ? undefined
                                    : String(field.value)
                                }
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Selecione" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {["1", "1.5", "2", "3", "4", "5"].map(
                                    (grout) => (
                                      <SelectItem key={grout} value={grout}>
                                        {grout.replace(".", ",")} mm
                                      </SelectItem>
                                    ),
                                  )}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="tipoPiso"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Tipo de Piso</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="Ex: Acetinado"
                                  disabled={!isEditing}
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="pecasPorCaixa"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Peças por Caixa</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  readOnly
                                  aria-readonly="true"
                                  placeholder="Calculado automaticamente"
                                  className="cursor-not-allowed bg-muted"
                                  {...field}
                                  value={field.value ?? ""}
                                />
                              </FormControl>
                              <p className="text-xs text-muted-foreground">
                                Calculado pela largura, altura e m² por caixa.
                              </p>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="m2PorCaixa"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>M² por Caixa *</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  step="0.01"
                                  placeholder="Ex: 1.44"
                                  disabled={!isEditing}
                                  {...field}
                                  value={field.value ?? ""}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div>
                        <FormField
                          control={form.control}
                          name="localDeUso"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Local de Uso</FormLabel>
                              <FormControl>
                                <Textarea
                                  placeholder="Descrição detalhada do local de uso"
                                  disabled={!isEditing}
                                  className="min-h-28 resize-y"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="classificacaoUso"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Classificação de Uso</FormLabel>
                              <Select
                                disabled={!isEditing}
                                onValueChange={handleClassificationChange}
                                value={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Selecione" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {(
                                    [
                                      "LA",
                                      "LB",
                                      "LC",
                                      "LD",
                                      "LE",
                                      "LF",
                                    ] as const
                                  ).map((classe) => (
                                    <SelectItem key={classe} value={classe}>
                                      {classe}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="acabamentoBordas"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Acabamento das Bordas *</FormLabel>
                              <Select
                                disabled={!isEditing}
                                onValueChange={handleBorderFinishChange}
                                value={field.value}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="RETIFICADO">
                                    Retificado
                                  </SelectItem>
                                  <SelectItem value="BOLD">Bold</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div>
                        <FormField
                          control={form.control}
                          name="linkSite"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Site do Piso</FormLabel>
                              <FormControl>
                                <Input
                                  type="url"
                                  placeholder="https://exemplo.com"
                                  disabled={!isEditing}
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="linkPaginacao"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Link da Paginação/Ambiente</FormLabel>
                              <FormControl>
                                <Input
                                  type="url"
                                  placeholder="https://exemplo.com/ambiente.jpg"
                                  disabled={!isEditing}
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="linkFoto"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Link da Foto do Piso</FormLabel>
                              <FormControl>
                                <Input
                                  type="url"
                                  placeholder="https://exemplo.com/foto.jpg"
                                  disabled={!isEditing}
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="valor"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Valor R$</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  step="0.01"
                                  placeholder="Ex: 89.90"
                                  disabled={!isEditing}
                                  {...field}
                                  value={field.value ?? ""}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="estoqueM2"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Estoque (m²)</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  disabled={!isEditing}
                                  {...field}
                                  value={field.value ?? ""}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="linkAreaCentral"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Link da Área Central</FormLabel>
                              <FormControl>
                                <Input
                                  type="url"
                                  disabled={!isEditing}
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="ativo"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Status</FormLabel>
                              <label className="flex h-10 items-center gap-2">
                                <input
                                  type="checkbox"
                                  disabled={!isEditing}
                                  checked={field.value}
                                  onChange={field.onChange}
                                  className="h-4 w-4 accent-primary"
                                />
                                <span className="text-sm">Produto ativo</span>
                              </label>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium">
                          Imagem do Piso
                        </label>
                        <div className="relative flex min-h-[300px] items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-3">
                          <PisoImage
                            primaryUrl={linkFotoValue}
                            fallbackUrl={legacyProductImageFallback(
                              linkFotoValue,
                              linkFotoOrigemValue,
                            )}
                            alt={selectedPiso?.nome ?? "Imagem do piso"}
                            className="max-h-[300px] w-full rounded-md object-contain"
                            fallbackClassName="min-h-[276px] w-full"
                          />
                          {isEditing && linkFotoValue && (
                            <button
                              type="button"
                              aria-label="Remover imagem do piso"
                              onClick={handleRemoveImage}
                              className="absolute right-2 top-2 rounded-full bg-destructive p-1.5 text-destructive-foreground shadow-sm transition-colors hover:bg-destructive/90"
                            >
                              <X size={14} />
                            </button>
                          )}
                        </div>
                        <input
                          ref={imageInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/avif"
                          className="hidden"
                          disabled={!isEditing}
                          onChange={handleFloorImageUpload}
                        />
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={!isEditing || isUploadingImage}
                            onClick={() => imageInputRef.current?.click()}
                          >
                            {isUploadingImage ? (
                              <Loader2
                                size={15}
                                className="mr-1.5 animate-spin"
                              />
                            ) : (
                              <Upload size={15} className="mr-1.5" />
                            )}
                            {isUploadingImage ? "Enviando..." : "Enviar imagem"}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={
                              !isEditing || !linkFotoValue || isUploadingImage
                            }
                            onClick={handleRemoveImage}
                          >
                            <Trash2 size={15} className="mr-1.5" />
                            Remover imagem
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          JPG, PNG, WebP ou AVIF, com até 5 MB. Depois clique em
                          Salvar.
                        </p>
                      </div>

                      <div className="flex flex-col gap-2">
                        <label className="text-sm font-medium">
                          Paginação/Ambiente
                        </label>
                        <div className="relative flex min-h-[300px] items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-3">
                          <PisoImage
                            primaryUrl={linkPaginacaoValue}
                            alt={`Paginação ou ambiente de ${selectedPiso?.nome ?? "piso"}`}
                            className="max-h-[300px] w-full rounded-md object-contain"
                            fallbackClassName="min-h-[276px] w-full"
                          />
                          {isEditing && linkPaginacaoValue && (
                            <button
                              type="button"
                              aria-label="Remover Paginação/Ambiente"
                              onClick={handleRemovePaginationImage}
                              className="absolute right-2 top-2 rounded-full bg-destructive p-1.5 text-destructive-foreground shadow-sm transition-colors hover:bg-destructive/90"
                            >
                              <X size={14} />
                            </button>
                          )}
                        </div>
                        <input
                          ref={paginationImageInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/avif"
                          className="hidden"
                          disabled={!isEditing}
                          onChange={handlePaginationImageUpload}
                        />
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={!isEditing || isUploadingPaginationImage}
                            onClick={() =>
                              paginationImageInputRef.current?.click()
                            }
                          >
                            {isUploadingPaginationImage ? (
                              <Loader2
                                size={15}
                                className="mr-1.5 animate-spin"
                              />
                            ) : (
                              <Upload size={15} className="mr-1.5" />
                            )}
                            {isUploadingPaginationImage
                              ? "Enviando..."
                              : "Enviar imagem"}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={
                              !isEditing ||
                              !linkPaginacaoValue ||
                              isUploadingPaginationImage
                            }
                            onClick={handleRemovePaginationImage}
                          >
                            <Trash2 size={15} className="mr-1.5" />
                            Remover imagem
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          JPG, PNG, WebP ou AVIF, com até 5 MB. Depois clique em
                          Salvar.
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={!linkSiteValue?.trim()}
                          onClick={handleOpenProductSite}
                          className="self-start"
                        >
                          <ExternalLink size={15} className="mr-1.5" />
                          Abrir site do piso
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 pt-6 border-t border-gray-200">
                    <div className="flex flex-wrap gap-3">
                      <Button
                        type="submit"
                        disabled={
                          !isEditing ||
                          createPiso.isPending ||
                          updatePiso.isPending
                        }
                        className="bg-primary hover:bg-primary/90 text-primary-foreground"
                      >
                        <Save size={18} className="mr-2" />
                        Salvar
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleEdit}
                        disabled={isEditing && !editingId}
                      >
                        <Edit size={18} className="mr-2" />
                        Alterar
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={handleDelete}
                      >
                        <Trash2 size={18} className="mr-2" />
                        Excluir
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleLimpar}
                      >
                        <Eraser size={18} className="mr-2" />
                        Limpar
                      </Button>
                      <div className="flex-1"></div>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() =>
                          document.getElementById("search-input")?.focus()
                        }
                      >
                        <Search size={18} className="mr-2" />
                        Pesquisar
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() =>
                          toast({
                            title: "Info",
                            description:
                              "Funcionalidade de impressão em breve.",
                          })
                        }
                      >
                        <Printer size={18} className="mr-2" />
                        Imprimir Etiqueta
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleLimpar}
                      >
                        <Plus size={18} className="mr-2" />
                        Novo
                      </Button>
                    </div>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        ) : (
          <Card className="sticky top-0 z-30 border bg-background/95 shadow-md backdrop-blur">
            <CardContent className="p-3">
              {selectedPiso ? (
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                  <div className="flex shrink-0 flex-col gap-2">
                    <PisoImage
                      primaryUrl={selectedPiso.linkFoto}
                      fallbackUrl={legacyProductImageFallback(
                        selectedPiso.linkFoto,
                        selectedPiso.linkFotoOrigem,
                      )}
                      alt={selectedPiso.nome}
                      className="h-24 w-24 rounded-md border bg-white object-contain"
                      fallbackClassName="h-24 w-24 border"
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-base font-semibold text-foreground">
                        {selectedPiso.nome}
                      </h2>
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] ${selectedPiso.ativo ? "bg-green-100 text-green-700" : "bg-zinc-100 text-zinc-600"}`}
                      >
                        {selectedPiso.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </div>

                    <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3 xl:grid-cols-6">
                      <div>
                        <span className="block text-muted-foreground">
                          ASSO
                        </span>
                        <span className="font-mono font-medium">
                          {selectedPiso.codigoRede ?? "—"}
                        </span>
                      </div>
                      <div>
                        <span className="block text-muted-foreground">CTC</span>
                        <span className="font-mono font-medium">
                          {selectedPiso.codigoLoja ?? "—"}
                        </span>
                      </div>
                      <div>
                        <span className="block text-muted-foreground">
                          Tamanho
                        </span>
                        <span className="font-medium">
                          {selectedPiso.largura && selectedPiso.altura
                            ? `${selectedPiso.largura}×${selectedPiso.altura} cm`
                            : "—"}
                        </span>
                      </div>
                      <div>
                        <span className="block text-muted-foreground">
                          Uso / Bordas
                        </span>
                        <span className="font-medium">
                          {selectedPiso.classificacaoUso ?? "—"} ·{" "}
                          {selectedPiso.acabamentoBordas === "RETIFICADO"
                            ? "Retificado"
                            : "Bold"}
                        </span>
                      </div>
                      <div>
                        <span className="block text-muted-foreground">
                          Estoque
                        </span>
                        <span className="font-medium">
                          {selectedPiso.estoqueM2.toFixed(2)} m²
                        </span>
                      </div>
                      <div>
                        <span className="block text-muted-foreground">
                          Valor
                        </span>
                        <span className="font-medium">
                          R$ {selectedPiso.valor.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2 lg:max-w-56 lg:justify-end">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={handleView}
                    >
                      <Eye size={15} className="mr-1.5" />
                      Ver
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleEdit}
                    >
                      <Edit size={15} className="mr-1.5" />
                      Alterar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={handleDelete}
                    >
                      <Trash2 size={15} className="mr-1.5" />
                      Excluir
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={handleNew}
                    >
                      <Plus size={15} className="mr-1.5" />
                      Novo
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">
                    Selecione um piso na lista para ver os detalhes.
                  </p>
                  <Button type="button" size="sm" onClick={handleNew}>
                    <Plus size={15} className="mr-1.5" />
                    Novo piso
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="mt-8">
          <div className="relative mb-6 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="search-input"
              placeholder="Buscar por nome ou código..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Identificação</TableHead>
                  <TableHead>Tamanho</TableHead>
                  <TableHead>Códigos</TableHead>
                  <TableHead>M²/Cx</TableHead>
                  <TableHead>Estoque</TableHead>
                  <TableHead>Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10">
                      <div className="flex flex-col items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                        <span className="mt-2 text-sm text-muted-foreground">
                          Carregando catálogo...
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : pisos && pisos.length > 0 ? (
                  pisos.map((piso) => (
                    <TableRow
                      key={piso.id}
                      onClick={() => handleSelectPiso(piso)}
                      className={`cursor-pointer transition-colors ${editingId === piso.id ? "bg-primary/5" : "hover:bg-muted/50"}`}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <PisoImage
                            primaryUrl={piso.linkFoto}
                            fallbackUrl={legacyProductImageFallback(
                              piso.linkFoto,
                              piso.linkFotoOrigem,
                            )}
                            alt={piso.nome}
                            className="h-11 w-11 shrink-0 rounded border bg-white object-contain"
                            fallbackClassName="h-11 w-11 shrink-0 rounded border text-[8px]"
                          />
                          <div className="min-w-0">
                            <div className="font-medium text-foreground">
                              {piso.nome}
                            </div>
                            <span
                              className={`mt-1 inline-block rounded px-2 py-0.5 text-[10px] ${piso.ativo ? "bg-green-100 text-green-700" : "bg-zinc-100 text-zinc-600"}`}
                            >
                              {piso.ativo ? "Ativo" : "Inativo"}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {piso.largura && piso.altura
                            ? `${piso.largura}x${piso.altura}cm`
                            : "-"}
                        </div>
                        <span className="text-[10px] text-muted-foreground inline-block mt-1">
                          {piso.acabamentoBordas === "RETIFICADO"
                            ? "Retificado"
                            : "Bold"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 font-mono text-xs">
                          <div>
                            <span className="text-muted-foreground">ASSO:</span>{" "}
                            {piso.codigoRede ?? "—"}
                          </div>
                          <div>
                            <span className="text-muted-foreground">CTC:</span>{" "}
                            {piso.codigoLoja ?? "—"}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">
                          {piso.m2PorCaixa} m²
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">
                          {piso.estoqueM2.toFixed(2)} m²
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">
                          R$ {piso.valor.toFixed(2)}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10">
                      <div className="flex flex-col items-center justify-center text-muted-foreground">
                        <p>Nenhum piso encontrado.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </Layout>
  );
}
