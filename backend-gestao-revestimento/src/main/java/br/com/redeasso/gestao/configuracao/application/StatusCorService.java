package br.com.redeasso.gestao.configuracao.application;

import br.com.redeasso.gestao.auditoria.application.AtividadeService;
import br.com.redeasso.gestao.configuracao.domain.StatusCor;
import br.com.redeasso.gestao.configuracao.infrastructure.StatusCorRepository;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class StatusCorService {
    private static final Set<String> CODIGOS = Set.of(
            "PADRAO", "ACABAR", "NEGOCIACAO", "FORA_DE_LINHA", "PRODUTO_LOCAL");
    private final StatusCorRepository repository;
    private final AtividadeService atividades;

    public StatusCorService(StatusCorRepository repository, AtividadeService atividades) {
        this.repository = repository;
        this.atividades = atividades;
    }

    @Transactional(readOnly = true)
    public List<Valor> consultar() {
        return repository.findAll().stream()
                .sorted(Comparator.comparing(StatusCor::getCodigo))
                .map(item -> new Valor(item.getCodigo(), item.getCor(), item.getVersao()))
                .toList();
    }

    @Transactional
    public List<Valor> salvar(List<Valor> valores) {
        if (valores == null || valores.size() != CODIGOS.size()
                || valores.stream().anyMatch(StatusCorService::invalido)
                || !new HashSet<>(valores.stream().map(Valor::codigo).toList()).equals(CODIGOS)) {
            throw new StatusConfiguracaoInvalidaException();
        }
        var rows = repository.findAll().stream()
                .collect(Collectors.toMap(StatusCor::getCodigo, Function.identity()));
        for (Valor valor : valores) {
            StatusCor row = rows.get(valor.codigo());
            if (row == null) throw new IllegalStateException("Paleta de status incompleta");
            if (row.getVersao() != valor.versao()) {
                throw new ObjectOptimisticLockingFailureException("StatusCor", valor.codigo());
            }
        }
        for (Valor valor : valores) {
            StatusCor row = rows.get(valor.codigo());
            if (!row.getCor().equalsIgnoreCase(valor.cor())) {
                atividades.registrar("configuracao", "Cor de %s: %s → %s"
                        .formatted(row.getCodigo(), row.getCor(), valor.cor()), null);
                row.atualizar(valor.cor());
            }
        }
        repository.flush();
        return consultar();
    }

    private static boolean invalido(Valor valor) {
        return valor == null || valor.codigo() == null || valor.cor() == null
                || !valor.cor().matches("^#[0-9A-Fa-f]{6}$") || valor.versao() < 0;
    }

    public record Valor(String codigo, String cor, long versao) {}
}
