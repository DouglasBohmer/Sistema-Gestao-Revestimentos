package br.com.redeasso.gestao.mapa.infrastructure;

import br.com.redeasso.gestao.mapa.domain.Mapa;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MapaRepository extends JpaRepository<Mapa, Long> {
    List<Mapa> findAllByOrderByIdAsc();
}
