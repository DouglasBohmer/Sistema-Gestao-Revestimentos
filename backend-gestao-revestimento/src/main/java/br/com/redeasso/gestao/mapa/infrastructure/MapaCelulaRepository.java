package br.com.redeasso.gestao.mapa.infrastructure;

import br.com.redeasso.gestao.mapa.domain.MapaCelula;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface MapaCelulaRepository extends JpaRepository<MapaCelula, Long> {
    List<MapaCelula> findAllByMapaIdOrderByPosicaoAscOrdemAsc(Long mapaId);

    List<MapaCelula> findAllByMapaIdInOrderByMapaIdAscPosicaoAscOrdemAsc(Collection<Long> mapaIds);

    void deleteAllByMapaIdAndPosicao(Long mapaId, String posicao);
}
