package br.com.redeasso.gestao.catalogo.api;
import br.com.redeasso.gestao.catalogo.infrastructure.PisoRepository;
import org.springframework.web.bind.annotation.*;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
@RestController
public class PisosRecentesController {
    private final PisoRepository repository;
    public PisosRecentesController(PisoRepository repository){this.repository=repository;}
    @GetMapping("/api/pisos/recentes") @Transactional(readOnly=true)
    public List<PisoResponse> recentes(){return repository.findTop15ByOrderByCreatedAtDescIdDesc().stream().map(PisoResponse::from).toList();}
}
