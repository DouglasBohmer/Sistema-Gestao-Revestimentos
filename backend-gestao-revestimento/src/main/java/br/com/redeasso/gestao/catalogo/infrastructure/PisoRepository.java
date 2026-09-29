package br.com.redeasso.gestao.catalogo.infrastructure;

import br.com.redeasso.gestao.catalogo.domain.Piso;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface PisoRepository extends JpaRepository<Piso, Long>, JpaSpecificationExecutor<Piso> {

    List<Piso> findAllByCodigoLojaOrCodigoRedeOrderByIdAsc(String codigoLoja, String codigoRede);

    @Query("""
            select count(p)
              from Piso p
             where lower(trim(p.nome)) = lower(trim(:nome))
            """)
    long contarPorNomeNormalizado(@Param("nome") String nome);

    @Query("""
            select count(p)
              from Piso p
             where lower(trim(p.nome)) = lower(trim(:nome))
               and p.id <> :idIgnorado
            """)
    long contarPorNomeNormalizadoIgnorandoId(
            @Param("nome") String nome,
            @Param("idIgnorado") Long idIgnorado);

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
