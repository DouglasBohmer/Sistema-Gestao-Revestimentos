package br.com.redeasso.gestao.catalogo.api;

import br.com.redeasso.gestao.catalogo.application.PisoService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@Validated
@RestController
@RequestMapping("/api/pisos")
public class PisoController {

    private final PisoService pisoService;

    public PisoController(PisoService pisoService) {
        this.pisoService = pisoService;
    }

    @GetMapping
    public List<PisoResponse> listar(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String localDeUso,
            @RequestParam(required = false) String tipoPiso) {
        return pisoService.listar(search, localDeUso, tipoPiso).stream()
                .map(PisoResponse::from)
                .toList();
    }

    @PostMapping
    public ResponseEntity<PisoResponse> cadastrar(@Valid @RequestBody PisoRequest request) {
        PisoResponse response = PisoResponse.from(pisoService.cadastrar(request.toDadosPiso()));
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/{id}")
    public PisoResponse buscarPorId(@PathVariable @Positive long id) {
        return PisoResponse.from(pisoService.buscarPorId(id));
    }

    @GetMapping("/codigo/{codigo}")
    public PisoResponse buscarPorCodigo(@PathVariable @Size(max = 100) String codigo) {
        return PisoResponse.from(pisoService.buscarPorCodigo(codigo));
    }

    @PutMapping("/{id}")
    public PisoResponse atualizar(
            @PathVariable @Positive long id,
            @Valid @RequestBody PisoRequest request) {
        return PisoResponse.from(pisoService.atualizar(id, request.toDadosPiso()));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> excluir(@PathVariable @Positive long id) {
        pisoService.excluir(id);
        return ResponseEntity.noContent().build();
    }
}
