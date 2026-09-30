package br.com.redeasso.gestao.calculo.application;

import br.com.redeasso.gestao.auditoria.application.AtividadeService;
import br.com.redeasso.gestao.calculo.api.CalculoResponse;
import br.com.redeasso.gestao.catalogo.api.PisoResponse;
import br.com.redeasso.gestao.catalogo.application.PisoService;
import br.com.redeasso.gestao.catalogo.domain.Piso;
import br.com.redeasso.gestao.configuracao.domain.ParametroSistema;
import br.com.redeasso.gestao.configuracao.infrastructure.ParametroSistemaRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class CalculoService {

    private static final BigDecimal MARGEM_PADRAO = BigDecimal.TEN;
    private static final BigDecimal CEM = BigDecimal.valueOf(100);
    private static final int ESCALA_CALCULO = 12;
    private static final int ESCALA_RESULTADO = 6;
    private static final String ARGAMASSA_PESO_SACO_KG = "ARGAMASSA_PESO_SACO_KG";
    private static final String ARGAMASSA_COBERTURA_SACO_M2 = "ARGAMASSA_COBERTURA_SACO_M2";
    private static final String REJUNTE_PROFUNDIDADE_MM = "REJUNTE_PROFUNDIDADE_MM";
    private static final String REJUNTE_COEFICIENTE = "REJUNTE_COEFICIENTE";
    private static final String REJUNTE_PESO_EMBALAGEM_KG = "REJUNTE_PESO_EMBALAGEM_KG";
    private static final String NIVELADOR_INTERVALO_CM = "NIVELADOR_INTERVALO_CM";
    private static final String NIVELADOR_PECAS_PACOTE = "NIVELADOR_PECAS_PACOTE";
    private static final List<String> CHAVES_MATERIAIS = List.of(
            ARGAMASSA_PESO_SACO_KG,
            ARGAMASSA_COBERTURA_SACO_M2,
            REJUNTE_PROFUNDIDADE_MM,
            REJUNTE_COEFICIENTE,
            REJUNTE_PESO_EMBALAGEM_KG,
            NIVELADOR_INTERVALO_CM,
            NIVELADOR_PECAS_PACOTE);

    private final PisoService pisoService;
    private final AtividadeService atividadeService;
    private final ParametroSistemaRepository parametroSistemaRepository;

    public CalculoService(
            PisoService pisoService,
            AtividadeService atividadeService,
            ParametroSistemaRepository parametroSistemaRepository) {
        this.pisoService = pisoService;
        this.atividadeService = atividadeService;
        this.parametroSistemaRepository = parametroSistemaRepository;
    }

    @Transactional
    public CalculoResponse calcular(
            String codigoPiso,
            BigDecimal metragemM2,
            BigDecimal margemQuebra) {
        return calcular(null, codigoPiso, metragemM2, null, margemQuebra);
    }

    @Transactional
    public CalculoResponse calcular(
            Long pisoId,
            String codigoPiso,
            BigDecimal metragemM2,
            Long quantidadeCaixasInformada,
            BigDecimal margemQuebra) {
        Piso piso = pisoId == null
                ? pisoService.buscarPorCodigo(codigoPiso)
                : pisoService.buscarPorId(pisoId);
        BigDecimal margemAplicada;
        BigDecimal metragemCalculada;
        BigDecimal metragemComMargem;
        long quantidadeCaixas;

        if (quantidadeCaixasInformada != null) {
            quantidadeCaixas = quantidadeCaixasInformada;
            metragemCalculada = piso.getM2PorCaixa()
                    .multiply(BigDecimal.valueOf(quantidadeCaixas))
                    .setScale(6, RoundingMode.HALF_UP);
            metragemComMargem = metragemCalculada;
            margemAplicada = BigDecimal.ZERO;
        } else {
            metragemCalculada = metragemM2;
            margemAplicada = margemQuebra == null ? MARGEM_PADRAO : margemQuebra;
            BigDecimal fatorMargem = BigDecimal.ONE.add(margemAplicada.divide(CEM));
            metragemComMargem = metragemCalculada
                    .multiply(fatorMargem)
                    .setScale(6, RoundingMode.HALF_UP);
            quantidadeCaixas = metragemComMargem
                    .divide(piso.getM2PorCaixa(), 0, RoundingMode.CEILING)
                    .longValueExact();
        }
        BigDecimal metragemVendidaM2 = piso.getM2PorCaixa()
                .multiply(BigDecimal.valueOf(quantidadeCaixas))
                .setScale(ESCALA_RESULTADO, RoundingMode.HALF_UP);
        ParametrosMateriais parametros = carregarParametrosMateriais();
        MateriaisArgamassa argamassa = calcularArgamassa(metragemVendidaM2, parametros);
        MateriaisRejunte rejunte = calcularRejunte(piso, metragemVendidaM2, parametros);
        MateriaisNiveladores niveladores = calcularNiveladores(piso, metragemVendidaM2, parametros);
        BigDecimal valorTotal = calcularValorTotal(piso, quantidadeCaixas);

        atividadeService.registrar(
                "calculo",
                "Cálculo realizado para %s".formatted(piso.getNome()),
                piso.getNome());

        return new CalculoResponse(
                PisoResponse.from(piso),
                metragemCalculada,
                margemAplicada,
                metragemComMargem,
                quantidadeCaixas,
                metragemVendidaM2,
                argamassa.quantidadeSacos(),
                argamassa.pesoKg(),
                rejunte.quantidadeEmbalagens(),
                rejunte.pesoKg(),
                niveladores.porLadoX(),
                niveladores.porLadoY(),
                niveladores.quantidade(),
                niveladores.quantidadePacotes(),
                valorTotal);
    }

    private ParametrosMateriais carregarParametrosMateriais() {
        Map<String, ParametroSistema> parametros = parametroSistemaRepository.findAllById(CHAVES_MATERIAIS)
                .stream()
                .collect(Collectors.toMap(ParametroSistema::getChave, Function.identity()));

        return new ParametrosMateriais(
                valorPositivo(parametros, ARGAMASSA_PESO_SACO_KG),
                valorPositivo(parametros, ARGAMASSA_COBERTURA_SACO_M2),
                valorPositivo(parametros, REJUNTE_PROFUNDIDADE_MM),
                valorPositivo(parametros, REJUNTE_COEFICIENTE),
                valorPositivo(parametros, REJUNTE_PESO_EMBALAGEM_KG),
                valorPositivo(parametros, NIVELADOR_INTERVALO_CM),
                valorPositivo(parametros, NIVELADOR_PECAS_PACOTE));
    }

    private static BigDecimal valorPositivo(Map<String, ParametroSistema> parametros, String chave) {
        ParametroSistema parametro = parametros.get(chave);
        if (parametro == null || parametro.getValor() == null || parametro.getValor().signum() <= 0) {
            throw new IllegalStateException("Parâmetro de cálculo ausente ou inválido: " + chave);
        }
        return parametro.getValor();
    }

    private static MateriaisArgamassa calcularArgamassa(
            BigDecimal metragemVendidaM2,
            ParametrosMateriais parametros) {
        BigDecimal sacosTeoricos = metragemVendidaM2.divide(
                parametros.coberturaSacoArgamassaM2(),
                ESCALA_CALCULO,
                RoundingMode.HALF_UP);
        long quantidadeSacos = sacosTeoricos
                .setScale(0, RoundingMode.CEILING)
                .longValueExact();
        BigDecimal pesoKg = sacosTeoricos
                .multiply(parametros.pesoSacoArgamassaKg())
                .setScale(ESCALA_RESULTADO, RoundingMode.HALF_UP);
        return new MateriaisArgamassa(quantidadeSacos, pesoKg);
    }

    private static MateriaisRejunte calcularRejunte(
            Piso piso,
            BigDecimal metragemVendidaM2,
            ParametrosMateriais parametros) {
        if (!positivo(piso.getLargura()) || !positivo(piso.getAltura()) || !positivo(piso.getRejunte())) {
            return new MateriaisRejunte(null, null);
        }

        BigDecimal larguraMm = piso.getLargura().movePointRight(1);
        BigDecimal alturaMm = piso.getAltura().movePointRight(1);
        BigDecimal somaLadosMm = larguraMm.add(alturaMm);
        BigDecimal areaPecaMm2 = larguraMm.multiply(alturaMm);
        BigDecimal kgPorM2 = somaLadosMm
                .multiply(parametros.profundidadeRejunteMm())
                .multiply(piso.getRejunte())
                .multiply(parametros.coeficienteRejunte())
                .divide(areaPecaMm2, ESCALA_CALCULO, RoundingMode.HALF_UP);
        BigDecimal pesoKg = metragemVendidaM2
                .multiply(kgPorM2)
                .setScale(ESCALA_RESULTADO, RoundingMode.HALF_UP);
        long quantidadeEmbalagens = pesoKg
                .divide(parametros.pesoEmbalagemRejunteKg(), 0, RoundingMode.CEILING)
                .longValueExact();
        return new MateriaisRejunte(quantidadeEmbalagens, pesoKg);
    }

    private static boolean positivo(BigDecimal valor) {
        return valor != null && valor.signum() > 0;
    }

    private static MateriaisNiveladores calcularNiveladores(
            Piso piso,
            BigDecimal metragemVendidaM2,
            ParametrosMateriais parametros) {
        if (!positivo(piso.getLargura()) || !positivo(piso.getAltura())) {
            return new MateriaisNiveladores(null, null, null, null);
        }

        long porLadoX = piso.getLargura()
                .divide(parametros.intervaloNiveladoresCm(), 0, RoundingMode.CEILING)
                .max(BigDecimal.ONE)
                .longValueExact();
        long porLadoY = piso.getAltura()
                .divide(parametros.intervaloNiveladoresCm(), 0, RoundingMode.CEILING)
                .max(BigDecimal.ONE)
                .longValueExact();
        BigDecimal areaPecaM2 = piso.getLargura()
                .multiply(piso.getAltura())
                .movePointLeft(4);
        long quantidade = BigDecimal.valueOf(porLadoX + porLadoY)
                .multiply(metragemVendidaM2)
                .divide(areaPecaM2, 0, RoundingMode.CEILING)
                .longValueExact();
        long quantidadePacotes = BigDecimal.valueOf(quantidade)
                .divide(parametros.pecasNiveladoresPorPacote(), 0, RoundingMode.CEILING)
                .longValueExact();

        return new MateriaisNiveladores(porLadoX, porLadoY, quantidade, quantidadePacotes);
    }

    private static BigDecimal calcularValorTotal(Piso piso, long quantidadeCaixas) {
        if (piso.getValor().signum() == 0) {
            return null;
        }

        return piso.getM2PorCaixa()
                .multiply(BigDecimal.valueOf(quantidadeCaixas))
                .multiply(piso.getValor())
                .setScale(2, RoundingMode.HALF_UP);
    }

    private record ParametrosMateriais(
            BigDecimal pesoSacoArgamassaKg,
            BigDecimal coberturaSacoArgamassaM2,
            BigDecimal profundidadeRejunteMm,
            BigDecimal coeficienteRejunte,
            BigDecimal pesoEmbalagemRejunteKg,
            BigDecimal intervaloNiveladoresCm,
            BigDecimal pecasNiveladoresPorPacote) {
    }

    private record MateriaisArgamassa(long quantidadeSacos, BigDecimal pesoKg) {
    }

    private record MateriaisRejunte(Long quantidadeEmbalagens, BigDecimal pesoKg) {
    }

    private record MateriaisNiveladores(
            Long porLadoX,
            Long porLadoY,
            Long quantidade,
            Long quantidadePacotes) {
    }
}
