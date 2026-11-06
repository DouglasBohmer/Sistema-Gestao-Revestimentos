package br.com.redeasso.gestao.calculo.api;

import br.com.redeasso.gestao.calculo.application.CalculoService;
import br.com.redeasso.gestao.catalogo.application.PisoAreaCentralService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/pisos/calcular")
public class CalculoController {

    private final CalculoService calculoService;
    private final PisoAreaCentralService areaCentral;

    public CalculoController(CalculoService calculoService, PisoAreaCentralService areaCentral) {
        this.calculoService = calculoService;
        this.areaCentral = areaCentral;
    }

    @PostMapping
    public CalculoResponse calcular(@Valid @RequestBody CalculoRequest request, HttpServletRequest httpRequest) {
        areaCentral.atualizarParaCalculo(request.pisoId(), request.codigoPiso(), httpRequest.getSession().getId());
        return calculoService.calcular(
                request.pisoId(),
                request.codigoPiso(),
                request.metragemM2(),
                request.quantidadeCaixas(),
                request.margemQuebra());
    }
}
