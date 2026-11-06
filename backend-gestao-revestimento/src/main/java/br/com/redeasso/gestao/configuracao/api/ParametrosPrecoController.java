package br.com.redeasso.gestao.configuracao.api;

import br.com.redeasso.gestao.configuracao.application.ParametrosPrecoService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.web.bind.annotation.*;
import java.math.BigDecimal;

@RestController
@RequestMapping("/api/parametros/preco")
public class ParametrosPrecoController {
    private final ParametrosPrecoService service;
    public ParametrosPrecoController(ParametrosPrecoService service) { this.service = service; }
    @GetMapping public ParametrosPrecoService.Valores consultar() { return service.consultar(); }
    @PutMapping public ParametrosPrecoService.Valores salvar(@Valid @RequestBody Input input) {
        return service.salvar(input.margemPercentual(), input.descontoPercentual(), input.versaoMargem(), input.versaoDesconto());
    }
    public record Input(
            @NotNull @DecimalMin("0") @Digits(integer=12, fraction=6) BigDecimal margemPercentual,
            @NotNull @DecimalMin("0") @DecimalMax("100") @Digits(integer=3, fraction=6) BigDecimal descontoPercentual,
            @NotNull @PositiveOrZero Long versaoMargem,
            @NotNull @PositiveOrZero Long versaoDesconto) {}
}
