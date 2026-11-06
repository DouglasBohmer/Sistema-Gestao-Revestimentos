package br.com.redeasso.gestao.catalogo.api;

import br.com.redeasso.gestao.catalogo.application.PisoAreaCentralService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/pisos/area-central")
public class PisoAreaCentralController {
    private final PisoAreaCentralService service;
    public PisoAreaCentralController(PisoAreaCentralService service) { this.service = service; }
    @PostMapping("/atualizar")
    public List<PisoAreaCentralService.Result> atualizar(@Valid @RequestBody Batch input, HttpServletRequest request) {
        return service.atualizar(input.ids(), request.getSession().getId());
    }
    public record Batch(@NotNull @Size(min=1, max=4) List<@NotNull @Positive Long> ids) {}
}
