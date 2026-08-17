package br.com.redeasso.gestao.calculo.api;

import br.com.redeasso.gestao.calculo.application.CalculoService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/pisos/calcular")
public class CalculoController {

    private final CalculoService calculoService;

    public CalculoController(CalculoService calculoService) {
        this.calculoService = calculoService;
    }

    @PostMapping
    public CalculoResponse calcular(@Valid @RequestBody CalculoRequest request) {
        return calculoService.calcular(
                request.codigoPiso(),
                request.metragemM2(),
                request.margemQuebra());
    }
}
