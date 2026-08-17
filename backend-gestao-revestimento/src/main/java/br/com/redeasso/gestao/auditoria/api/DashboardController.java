package br.com.redeasso.gestao.auditoria.api;

import br.com.redeasso.gestao.auditoria.application.AtividadeService;
import br.com.redeasso.gestao.auditoria.domain.Atividade;
import br.com.redeasso.gestao.catalogo.infrastructure.PisoRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;

@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {

    private final PisoRepository pisoRepository;
    private final AtividadeService atividadeService;

    public DashboardController(PisoRepository pisoRepository, AtividadeService atividadeService) {
        this.pisoRepository = pisoRepository;
        this.atividadeService = atividadeService;
    }

    @GetMapping("/stats")
    public DashboardStats stats() {
        long totalPisos = pisoRepository.count();
        return new DashboardStats(
                totalPisos,
                atividadeService.contarPorTipo("calculo"),
                atividadeService.contarPorTipo("impressao"),
                totalPisos);
    }

    @GetMapping("/atividade-recente")
    public List<AtividadeResponse> atividadeRecente() {
        return atividadeService.listarRecentes().stream()
                .map(AtividadeResponse::from)
                .toList();
    }

    @GetMapping("/pisos-por-tipo")
    public List<GrupoTipo> pisosPorTipo() {
        return pisoRepository.contarPorTipo().stream()
                .map(grupo -> new GrupoTipo(grupo.getTipo(), grupo.getTotal()))
                .toList();
    }

    public record DashboardStats(
            long totalPisos,
            long calculosRealizados,
            long totalImpressoes,
            long estoqueDisponivel) {
    }

    public record AtividadeResponse(
            Long id,
            String tipo,
            String descricao,
            String pisoNome,
            Instant createdAt) {

        static AtividadeResponse from(Atividade atividade) {
            return new AtividadeResponse(
                    atividade.getId(),
                    atividade.getTipo(),
                    atividade.getDescricao(),
                    atividade.getPisoNome(),
                    atividade.getCreatedAt());
        }
    }

    public record GrupoTipo(String tipo, long total) {
    }
}
