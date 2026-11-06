package br.com.redeasso.gestao.configuracao.application;

import br.com.redeasso.gestao.auditoria.application.AtividadeService;
import br.com.redeasso.gestao.configuracao.domain.ParametroSistema;
import br.com.redeasso.gestao.configuracao.infrastructure.ParametroSistemaRepository;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.util.List;

@Service
public class ParametrosPrecoService {
    public static final String MARGEM = "PRECO_LUCRO_PERCENTUAL";
    public static final String DESCONTO = "PRECO_DESCONTO_PERCENTUAL";
    private final ParametroSistemaRepository repository;
    private final AtividadeService atividades;

    public ParametrosPrecoService(ParametroSistemaRepository repository, AtividadeService atividades) {
        this.repository = repository; this.atividades = atividades;
    }

    @Transactional(readOnly = true)
    public Valores consultar() { return valores(carregar()); }

    @Transactional
    public Valores salvar(BigDecimal margem, BigDecimal desconto, long versaoMargem, long versaoDesconto) {
        if (margem == null || desconto == null || margem.signum() < 0 || desconto.signum() < 0
                || desconto.compareTo(BigDecimal.valueOf(100)) > 0) throw new IllegalArgumentException("Percentuais inválidos");
        var parametros = carregar();
        var margemAtual = parametro(parametros, MARGEM);
        var descontoAtual = parametro(parametros, DESCONTO);
        if (margemAtual.getVersao() != versaoMargem || descontoAtual.getVersao() != versaoDesconto) {
            throw new ObjectOptimisticLockingFailureException(ParametroSistema.class, MARGEM);
        }
        if (margem.compareTo(margemAtual.getValor()) == 0 && desconto.compareTo(descontoAtual.getValor()) == 0) return valores(parametros);
        String descricao = "Preço: margem %s%% → %s%%; desconto %s%% → %s%%".formatted(
                margemAtual.getValor().toPlainString(), margem.toPlainString(), descontoAtual.getValor().toPlainString(), desconto.toPlainString());
        margemAtual.atualizarValor(margem); descontoAtual.atualizarValor(desconto);
        repository.flush(); // @Version garante rollback do par em caso de concorrência.
        atividades.registrar("configuracao", descricao, null);
        return valores(parametros);
    }

    private List<ParametroSistema> carregar() { return repository.findAllById(List.of(MARGEM, DESCONTO)); }
    private static ParametroSistema parametro(List<ParametroSistema> parametros, String chave) {
        return parametros.stream().filter(item -> chave.equals(item.getChave())).findFirst()
                .orElseThrow(() -> new IllegalStateException("Parâmetros de preço não configurados"));
    }
    private static Valores valores(List<ParametroSistema> parametros) {
        var margem = parametro(parametros, MARGEM); var desconto = parametro(parametros, DESCONTO);
        return new Valores(margem.getValor(), desconto.getValor(), margem.getVersao(), desconto.getVersao());
    }
    public record Valores(BigDecimal margemPercentual, BigDecimal descontoPercentual, long versaoMargem, long versaoDesconto) {}
}
