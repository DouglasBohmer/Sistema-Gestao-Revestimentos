package br.com.redeasso.gestao.calculo.api;
import br.com.redeasso.gestao.calculo.application.CalculoHistoricoService;
import org.springframework.web.bind.annotation.*;
import java.util.List;
@RestController @RequestMapping("/api/calculos/historico")
public class CalculoHistoricoController {
    private final CalculoHistoricoService service;
    public CalculoHistoricoController(CalculoHistoricoService service){this.service=service;}
    @GetMapping public List<CalculoHistoricoService.Resumo> recentes(){return service.recentes();}
    @GetMapping("/{id}") public CalculoResponse reabrir(@PathVariable long id){return service.reabrir(id);}
}
