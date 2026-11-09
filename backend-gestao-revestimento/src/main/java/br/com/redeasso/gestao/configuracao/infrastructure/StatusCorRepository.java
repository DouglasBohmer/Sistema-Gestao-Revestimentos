package br.com.redeasso.gestao.configuracao.infrastructure;
import br.com.redeasso.gestao.configuracao.domain.StatusCor;
import org.springframework.data.jpa.repository.JpaRepository;
public interface StatusCorRepository extends JpaRepository<StatusCor,String>{}
