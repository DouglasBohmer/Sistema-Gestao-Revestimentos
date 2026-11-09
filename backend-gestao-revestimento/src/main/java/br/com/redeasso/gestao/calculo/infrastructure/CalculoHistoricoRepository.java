package br.com.redeasso.gestao.calculo.infrastructure;
import br.com.redeasso.gestao.calculo.domain.CalculoHistorico;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
public interface CalculoHistoricoRepository extends JpaRepository<CalculoHistorico,Long> {
    List<CalculoHistorico> findTop15ByOrderByCriadoEmDescIdDesc();
}
