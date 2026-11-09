package br.com.redeasso.gestao.configuracao.application;

import br.com.redeasso.gestao.auditoria.application.AtividadeService;
import br.com.redeasso.gestao.configuracao.infrastructure.StatusCorRepository;
import org.junit.jupiter.api.Test;
import java.util.List;
import java.util.stream.Stream;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class StatusCorServiceTest {
    private final StatusCorRepository repository = mock(StatusCorRepository.class);
    private final AtividadeService atividades = mock(AtividadeService.class);
    private final StatusCorService service = new StatusCorService(repository, atividades);
    private List<StatusCorService.Valor> valores() {
        return Stream.of("PADRAO", "ACABAR", "NEGOCIACAO", "FORA_DE_LINHA", "PRODUTO_LOCAL")
                .map(code -> new StatusCorService.Valor(code, "#123456", 0)).toList();
    }
    @Test void rejeitaParcialDuplicadoOuCodigosDesconhecidosAntesDeGravar() {
        var validos = valores();
        var duplicados = new java.util.ArrayList<>(validos);
        duplicados.set(4, validos.getFirst());
        for (var invalidos : List.of(List.<StatusCorService.Valor>of(), validos.subList(0,4), duplicados)) {
            assertThatThrownBy(() -> service.salvar(invalidos)).isInstanceOf(StatusConfiguracaoInvalidaException.class);
        }
        verifyNoInteractions(repository, atividades);
    }
    @Test void rejeitaCorMalformadaOuVersaoNegativa() {
        for (var valor : List.of(new StatusCorService.Valor("PADRAO", "red", 0), new StatusCorService.Valor("PADRAO", "#123456", -1))) {
            var invalidos = new java.util.ArrayList<>(valores());
            invalidos.set(0, valor);
            assertThatThrownBy(() -> service.salvar(invalidos)).isInstanceOf(StatusConfiguracaoInvalidaException.class);
        }
        verifyNoInteractions(repository, atividades);
    }
}
