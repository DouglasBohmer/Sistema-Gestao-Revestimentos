package br.com.redeasso.gestao.catalogo.api;

import br.com.redeasso.gestao.catalogo.domain.DadosPiso;
import br.com.redeasso.gestao.catalogo.domain.AcabamentoBorda;
import br.com.redeasso.gestao.catalogo.domain.ClassificacaoUso;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record PisoRequest(
        @NotBlank @Size(max = 200) String nome,
        @Size(max = 100) String codigoRede,
        @Size(max = 100) String codigoLoja,
        @DecimalMin(value = "0", inclusive = false) @Digits(integer = 12, fraction = 6) BigDecimal largura,
        @DecimalMin(value = "0", inclusive = false) @Digits(integer = 12, fraction = 6) BigDecimal altura,
        @DecimalMin("0") @Digits(integer = 12, fraction = 6) BigDecimal rejunte,
        @DecimalMin(value = "0", inclusive = false) @Digits(integer = 12, fraction = 6) BigDecimal pecasPorCaixa,
        @NotNull @DecimalMin(value = "0", inclusive = false) @Digits(integer = 12, fraction = 6) BigDecimal m2PorCaixa,
        @Size(max = 255) String localDeUso,
        @Size(max = 100) String tipoPiso,
        ClassificacaoUso classificacaoUso,
        @NotNull AcabamentoBorda acabamentoBordas,
        @Size(max = 2048) String linkSite,
        @Size(max = 2048) String linkFoto,
        @Size(max = 2048) String linkFotoOrigem,
        @Size(max = 2048) String linkPaginacao,
        @Size(max = 2048) String linkAreaCentral,
        @DecimalMin("0") @Digits(integer = 12, fraction = 6) BigDecimal valor,
        @DecimalMin("0") @Digits(integer = 12, fraction = 6) BigDecimal estoqueM2,
        Boolean ativo) {

    @AssertTrue(message = "Ao menos um código ASSO ou CTC é obrigatório")
    public boolean isCodigoInformado() {
        return temTexto(codigoRede) || temTexto(codigoLoja);
    }

    DadosPiso toDadosPiso() {
        return new DadosPiso(
                nome,
                codigoRede,
                codigoLoja,
                largura,
                altura,
                rejunte,
                pecasPorCaixa,
                m2PorCaixa,
                localDeUso,
                tipoPiso,
                classificacaoUso,
                acabamentoBordas,
                linkSite,
                linkFoto,
                linkFotoOrigem,
                linkPaginacao,
                linkAreaCentral,
                valor,
                estoqueM2,
                ativo);
    }

    private static boolean temTexto(String valor) {
        return valor != null && !valor.isBlank();
    }
}
