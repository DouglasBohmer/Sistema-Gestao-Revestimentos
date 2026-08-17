package br.com.redeasso.gestao.catalogo.infrastructure;

import br.com.redeasso.gestao.catalogo.domain.Piso;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface PisoRepository extends JpaRepository<Piso, Long>, JpaSpecificationExecutor<Piso> {

    Optional<Piso> findFirstByCodigoLojaOrCodigoRedeOrderByIdAsc(String codigoLoja, String codigoRede);

    @Query("""
            select coalesce(p.tipoPiso, 'Outros') as tipo, count(p) as total
              from Piso p
             group by p.tipoPiso
             order by min(p.id)
            """)
    List<PisosPorTipo> contarPorTipo();

    interface PisosPorTipo {
        String getTipo();

        long getTotal();
    }
}
