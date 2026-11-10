import type {
  Piso,
  PisoConsultaAreaCentral,
  PisoInput,
} from "@workspace/api-client-react";

/** Só preenche o rascunho. IDs/autorizações não são copiados para o payload do cadastro. */
export function preencherCadastro<T extends PisoInput & { ativo: boolean }>(
  atual: T,
  consulta: PisoConsultaAreaCentral,
  cadastro?: Piso,
): T {
  if (!consulta.encontrado || !consulta.nome)
    throw new Error("Produto não encontrado");
  const base = cadastro
    ? {
        ...atual,
        codigoLoja: cadastro.codigoLoja || "",
        largura: cadastro.largura ?? undefined,
        altura: cadastro.altura ?? undefined,
        rejunte: cadastro.rejunte ?? undefined,
        pecasPorCaixa: cadastro.pecasPorCaixa ?? undefined,
        m2PorCaixa: cadastro.m2PorCaixa,
        localDeUso: cadastro.localDeUso || "",
        tipoPiso: cadastro.tipoPiso || "",
        classificacaoUso: cadastro.classificacaoUso ?? undefined,
        acabamentoBordas: cadastro.acabamentoBordas,
        linkSite: cadastro.linkSite || "",
        linkFoto: cadastro.linkFoto || "",
        linkFotoOrigem: cadastro.linkFotoOrigem || "",
        linkPaginacao: cadastro.linkPaginacao || "",
        linkAreaCentral: cadastro.linkAreaCentral || "",
      }
    : { ...atual };
  return {
    ...base,
    codigoRede: consulta.codigoRede,
    nome: consulta.nome,
    m2PorCaixa: consulta.m2PorCaixa ?? base.m2PorCaixa,
    valor: consulta.valorVendaM2 ?? base.valor,
    estoqueM2: consulta.estoqueM2 ?? base.estoqueM2,
    ativo: true,
    largura: base.largura ?? consulta.largura ?? undefined,
    altura: base.altura ?? consulta.altura ?? undefined,
    acabamentoBordas:
      cadastro?.acabamentoBordas ??
      consulta.acabamentoBordas ??
      base.acabamentoBordas,
    rejunte:
      !cadastro && consulta.acabamentoBordas === "BOLD" && base.rejunte === 2
        ? 5
        : base.rejunte,
    linkFoto: base.linkFoto || consulta.linkFoto || "",
    linkFotoOrigem:
      base.linkFotoOrigem || (!base.linkFoto ? consulta.linkFoto || "" : ""),
  };
}

export const pesquisaPisoUrl = (nome: string) =>
  `https://www.google.com/search?q=${encodeURIComponent(nome)}`;

/** Reservar a guia no próprio Enter evita bloqueio de popup depois do await. */
export function abrirPesquisaPiso(
  open: (url: string, target: string) => Window | null = (url, target) =>
    window.open(url, target),
) {
  let tab: Window | null = null;
  try {
    tab = open("about:blank", "_blank");
    if (!tab) return null;
    tab.opener = null;
    tab.document.title = "Consultando piso na Área Central";
    tab.document.body.textContent =
      "Consultando o código ASSO. A pesquisa pelo nome do piso será aberta após a consulta.";
  } catch {
    try {
      tab?.close();
    } catch {}
    return null;
  }
  return {
    pesquisar(nome: string) {
      try {
        if (tab && !tab.closed && tab.location.href === "about:blank")
          tab.location.replace(pesquisaPisoUrl(nome));
      } catch {
        /* Guia navegada pelo usuário: não interferir. */
      }
    },
    fechar() {
      try {
        if (tab && !tab.closed && tab.location.href === "about:blank")
          tab.close();
      } catch {
        /* Não fechar outra página aberta pelo usuário. */
      }
    },
  };
}
