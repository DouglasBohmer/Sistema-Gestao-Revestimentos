package br.com.redeasso.gestao.calculo.application;
import br.com.redeasso.gestao.calculo.api.CalculoResponse;
import br.com.redeasso.gestao.calculo.domain.CalculoHistorico;
import br.com.redeasso.gestao.calculo.infrastructure.CalculoHistoricoRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
@Service
public class CalculoHistoricoService {
    private final CalculoHistoricoRepository repository;
    public CalculoHistoricoService(CalculoHistoricoRepository repository) {
        this.repository = repository;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void registrar(CalculoResponse resultado, Map<String, BigDecimal> parametros) {
        repository.save(new CalculoHistorico(resultado, parametros));
    }

    @Transactional(readOnly = true)
    public List<Resumo> recentes() {
        return repository.findTop15ByOrderByCriadoEmDescIdDesc().stream()
                .map(item -> new Resumo(item.getId(), item.getPisoNome(), item.getCriadoEm(),
                        item.getResultado().quantidadeCaixas(), item.getResultado().metragemVendidaM2()))
                .toList();
    }

    @Transactional(readOnly = true)
    public CalculoResponse reabrir(long id) {
        return repository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Cálculo não encontrado"))
                .getResultado();
    }

    public record Resumo(Long id, String pisoNome, Instant criadoEm, long quantidadeCaixas,
                         BigDecimal metragemVendidaM2) {}
}
