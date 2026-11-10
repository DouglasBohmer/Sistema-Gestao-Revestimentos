package br.com.redeasso.gestao.catalogo.application;

import br.com.redeasso.gestao.catalogo.api.PisoConsultaAreaCentralResponse;
import br.com.redeasso.gestao.catalogo.api.PisoResponse;
import br.com.redeasso.gestao.catalogo.domain.AcabamentoBorda;
import br.com.redeasso.gestao.catalogo.infrastructure.PisoRepository;
import br.com.redeasso.gestao.configuracao.application.ParametrosPrecoService;
import br.com.redeasso.gestao.integracao.areacentral.application.AreaCentralProductClient.Product;
import br.com.redeasso.gestao.integracao.areacentral.application.AreaCentralProductException;
import br.com.redeasso.gestao.shared.domain.PrecoVenda;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.util.Locale;
import java.util.regex.Pattern;
import static br.com.redeasso.gestao.integracao.areacentral.application.AreaCentralProductException.Code.INVALID_RESPONSE;

@Service
public class PisoCadastroAreaCentralReader {
    private static final Pattern FORMATO = Pattern.compile("(?<![\\d.,])(\\d{1,3}(?:[.,]\\d{1,2})?)\\s*[xX×]\\s*(\\d{1,3}(?:[.,]\\d{1,2})?)(?![\\d.,])");
    private final PisoRepository pisos;
    private final ParametrosPrecoService precos;

    public PisoCadastroAreaCentralReader(PisoRepository pisos, ParametrosPrecoService precos) {
        this.pisos = pisos;
        this.precos = precos;
    }

    /** Só acessa o banco depois que a chamada ao portal já terminou. */
    @Transactional(readOnly = true)
    public PisoConsultaAreaCentralResponse preparar(String codigo, Product produto) {
        var cadastros = pisos.findAllByCodigoRedeOrderByIdAsc(codigo).stream().map(PisoResponse::from).toList();
        if (!produto.encontrado()) return new PisoConsultaAreaCentralResponse(codigo, false, null, null,
                null, null, produto.status(), null, null, null, null, null, cadastros);
        if (produto.nome() == null || produto.nome().isBlank()) throw new AreaCentralProductException(INVALID_RESPONSE);
        var parametros = precos.consultar();
        if (parametros.margemPercentual().signum() < 0 || parametros.descontoPercentual().signum() < 0
                || parametros.descontoPercentual().compareTo(BigDecimal.valueOf(100)) > 0) {
            throw new AreaCentralProductException(INVALID_RESPONSE);
        }
        var venda = PrecoVenda.arredondar(produto.valorBrutoM2()
                .multiply(BigDecimal.ONE.add(parametros.margemPercentual().movePointLeft(2)))
                .multiply(BigDecimal.ONE.subtract(parametros.descontoPercentual().movePointLeft(2))));
        if (venda.precision() - venda.scale() > 12) throw new AreaCentralProductException(INVALID_RESPONSE);
        BigDecimal largura = null, altura = null;
        var formato = FORMATO.matcher(produto.nome());
        if (formato.find()) {
            boolean unidadeNaoSuportada = Pattern.compile("(?i)^\\s*(?:mm\\b|m\\b|m2\\b|m²|pol\\b|[\"″])")
                    .matcher(produto.nome().substring(formato.end())).find();
            largura = new BigDecimal(formato.group(1).replace(',', '.'));
            altura = new BigDecimal(formato.group(2).replace(',', '.'));
            // Múltiplos formatos no nome são ambíguos; nunca escolher silenciosamente.
            if (unidadeNaoSuportada || largura.signum() <= 0 || altura.signum() <= 0 || formato.find()) { largura = null; altura = null; }
        }
        String nome = produto.nome().toUpperCase(Locale.ROOT);
        boolean retificado = Pattern.compile("\\bRET(?:IF(?:ICADO)?)?\\b").matcher(nome).find();
        boolean bold = Pattern.compile("\\bBOLD\\b").matcher(nome).find();
        AcabamentoBorda bordas = retificado == bold ? null : retificado ? AcabamentoBorda.RETIFICADO : AcabamentoBorda.BOLD;
        return new PisoConsultaAreaCentralResponse(codigo, true, produto.nome(), produto.valorBrutoM2(), venda,
                produto.estoqueM2(), produto.status(), produto.m2PorCaixa(), produto.linkFoto(), largura, altura,
                bordas, cadastros);
    }
}
