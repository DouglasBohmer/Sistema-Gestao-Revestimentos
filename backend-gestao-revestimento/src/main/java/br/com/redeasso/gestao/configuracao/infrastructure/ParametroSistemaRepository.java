package br.com.redeasso.gestao.configuracao.infrastructure;

import br.com.redeasso.gestao.configuracao.domain.ParametroSistema;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ParametroSistemaRepository extends JpaRepository<ParametroSistema, String> {
}
