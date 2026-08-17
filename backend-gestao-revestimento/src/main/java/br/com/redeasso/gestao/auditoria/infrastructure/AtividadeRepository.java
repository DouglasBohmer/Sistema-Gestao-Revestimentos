package br.com.redeasso.gestao.auditoria.infrastructure;

import br.com.redeasso.gestao.auditoria.domain.Atividade;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AtividadeRepository extends JpaRepository<Atividade, Long> {

    long countByTipo(String tipo);

    List<Atividade> findTop10ByOrderByCreatedAtDescIdDesc();
}
