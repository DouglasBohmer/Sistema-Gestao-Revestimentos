package br.com.redeasso.gestao.calculo.application;

import br.com.redeasso.gestao.auditoria.application.AtividadeService;
import br.com.redeasso.gestao.calculo.api.CalculoResponse;
import br.com.redeasso.gestao.catalogo.api.PisoResponse;
import br.com.redeasso.gestao.catalogo.application.PisoService;
import br.com.redeasso.gestao.catalogo.domain.Piso;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;

@Service
public class CalculoService {

    private static final BigDecimal MARGEM_PADRAO = BigDecimal.TEN;
    private static final BigDecimal CEM = BigDecimal.valueOf(100);

    private final PisoService pisoService;
    private final AtividadeService atividadeService;

    public CalculoService(PisoService pisoService, AtividadeService atividadeService) {
        this.pisoService = pisoService;
        this.atividadeService = atividadeService;
    }

    @Transactional
    public CalculoResponse calcular(
            String codigoPiso,
            BigDecimal metragemM2,
            BigDecimal margemQuebra) {
        Piso piso = pisoService.buscarPorCodigo(codigoPiso);
        BigDecimal margemAplicada = margemQuebra == null ? MARGEM_PADRAO : margemQuebra;
        BigDecimal fatorMargem = BigDecimal.ONE.add(margemAplicada.divide(CEM));
        BigDecimal metragemComMargem = metragemM2
                .multiply(fatorMargem)
                .setScale(6, RoundingMode.HALF_UP);
        long quantidadeCaixas = metragemComMargem
                .divide(piso.getM2PorCaixa(), 0, RoundingMode.CEILING)
                .longValueExact();
        BigDecimal valorTotal = calcularValorTotal(piso, quantidadeCaixas);

        atividadeService.registrar(
                "calculo",
                "Cálculo realizado para %s".formatted(piso.getNome()),
                piso.getNome());

        return new CalculoResponse(
                PisoResponse.from(piso),
                metragemM2,
                margemAplicada,
                metragemComMargem,
                quantidadeCaixas,
                valorTotal);
    }

    private static BigDecimal calcularValorTotal(Piso piso, long quantidadeCaixas) {
        if (piso.getValor() == null) {
            return null;
        }

        return piso.getM2PorCaixa()
                .multiply(BigDecimal.valueOf(quantidadeCaixas))
                .multiply(piso.getValor())
                .setScale(2, RoundingMode.HALF_UP);
    }
}
