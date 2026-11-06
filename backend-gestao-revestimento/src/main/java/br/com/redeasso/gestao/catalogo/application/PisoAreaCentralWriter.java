package br.com.redeasso.gestao.catalogo.application;

import br.com.redeasso.gestao.catalogo.domain.Piso;
import br.com.redeasso.gestao.catalogo.infrastructure.PisoRepository;
import br.com.redeasso.gestao.configuracao.infrastructure.ParametroSistemaRepository;
import br.com.redeasso.gestao.integracao.areacentral.application.AreaCentralProductClient.Product;
import br.com.redeasso.gestao.integracao.areacentral.application.AreaCentralProductException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.time.Instant;
import static br.com.redeasso.gestao.integracao.areacentral.application.AreaCentralProductException.Code.*;

/** Transação curta: nunca manter conexão Neon aberta durante o acesso ao portal. */
@Service
public class PisoAreaCentralWriter {
    private final PisoRepository pisos;
    private final ParametroSistemaRepository parametros;
    public PisoAreaCentralWriter(PisoRepository pisos, ParametroSistemaRepository parametros) {
        this.pisos = pisos; this.parametros = parametros;
    }
    @Transactional
    public Piso atualizar(long id, String codigoConsultado, Product product) {
        Piso piso = pisos.findById(id).orElseThrow(PisoNaoEncontradoException::new);
        if (!codigoConsultado.equals(piso.getCodigoRede())) throw new AreaCentralProductException(PRODUCT_CHANGED);
        BigDecimal valorVenda = null;
        if (product.encontrado()) {
            var valores = parametros.findAllById(java.util.List.of("PRECO_LUCRO_PERCENTUAL", "PRECO_DESCONTO_PERCENTUAL"));
            BigDecimal lucro = parametro(valores, "PRECO_LUCRO_PERCENTUAL");
            BigDecimal desconto = parametro(valores, "PRECO_DESCONTO_PERCENTUAL");
            if (lucro.signum() < 0 || desconto.signum() < 0 || desconto.compareTo(BigDecimal.valueOf(100)) > 0) {
                throw new AreaCentralProductException(INVALID_RESPONSE);
            }
            valorVenda = br.com.redeasso.gestao.shared.domain.PrecoVenda.arredondar(
                    product.valorBrutoM2().multiply(BigDecimal.ONE.add(lucro.movePointLeft(2)))
                    .multiply(BigDecimal.ONE.subtract(desconto.movePointLeft(2))));
            if (valorVenda.precision() - valorVenda.scale() > 12) throw new AreaCentralProductException(INVALID_RESPONSE);
        }
        piso.atualizarPelaAreaCentral(product.encontrado(), valorVenda, product.estoqueM2(), product.status(), Instant.now());
        return pisos.save(piso);
    }
    private BigDecimal parametro(java.util.List<br.com.redeasso.gestao.configuracao.domain.ParametroSistema> valores, String key) {
        return valores.stream().filter(item -> key.equals(item.getChave())).findFirst()
                .orElseThrow(() -> new AreaCentralProductException(INVALID_RESPONSE)).getValor();
    }
}
