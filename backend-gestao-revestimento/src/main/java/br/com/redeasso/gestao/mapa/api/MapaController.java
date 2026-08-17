package br.com.redeasso.gestao.mapa.api;

import br.com.redeasso.gestao.mapa.api.dto.AtualizarCelulaRequest;
import br.com.redeasso.gestao.mapa.api.dto.AtualizarMapaRequest;
import br.com.redeasso.gestao.mapa.api.dto.CriarMapaRequest;
import br.com.redeasso.gestao.mapa.api.dto.MapaResponse;
import br.com.redeasso.gestao.mapa.application.MapaService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/mapas")
public class MapaController {

    private final MapaService service;

    public MapaController(MapaService service) {
        this.service = service;
    }

    @GetMapping
    public List<MapaResponse> listar() {
        return service.listar();
    }

    @GetMapping("/{id}")
    public MapaResponse buscar(@PathVariable Long id) {
        return service.buscar(id);
    }

    @PostMapping
    public ResponseEntity<MapaResponse> criar(@RequestBody CriarMapaRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.criar(request));
    }

    @PutMapping("/{id}")
    public MapaResponse atualizar(@PathVariable Long id, @RequestBody AtualizarMapaRequest request) {
        return service.atualizar(id, request);
    }

    @PutMapping("/{id}/celulas/{pos}")
    public MapaResponse atualizarCelula(
            @PathVariable Long id,
            @PathVariable String pos,
            @RequestBody AtualizarCelulaRequest request) {
        return service.atualizarCelula(id, pos, request);
    }

    @DeleteMapping("/{id}/celulas/{pos}")
    public MapaResponse limparCelula(@PathVariable Long id, @PathVariable String pos) {
        return service.limparCelula(id, pos);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> excluir(@PathVariable Long id) {
        service.excluir(id);
        return ResponseEntity.noContent().build();
    }
}
