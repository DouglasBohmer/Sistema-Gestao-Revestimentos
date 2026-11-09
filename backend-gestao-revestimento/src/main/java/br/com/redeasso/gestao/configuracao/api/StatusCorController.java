package br.com.redeasso.gestao.configuracao.api;
import br.com.redeasso.gestao.configuracao.application.StatusCorService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.web.bind.annotation.*;
import java.util.List;
@RestController @RequestMapping("/api/configuracoes/status")
public class StatusCorController {
    private final StatusCorService service;
    public StatusCorController(StatusCorService service){this.service=service;}
    @GetMapping public List<StatusCorService.Valor> consultar(){return service.consultar();}
    @PutMapping public List<StatusCorService.Valor> salvar(@Valid @RequestBody Input input){return service.salvar(input.status().stream().map(item->new StatusCorService.Valor(item.codigo(),item.cor(),item.versao())).toList());}
    public record Input(@NotNull @Size(min=5,max=5) List<@NotNull @Valid Item> status){}
    public record Item(@NotNull @Pattern(regexp="PADRAO|ACABAR|NEGOCIACAO|FORA_DE_LINHA|PRODUTO_LOCAL")String codigo,
                       @NotNull @Pattern(regexp="#[0-9A-Fa-f]{6}")String cor,@NotNull @PositiveOrZero Long versao){}
}
