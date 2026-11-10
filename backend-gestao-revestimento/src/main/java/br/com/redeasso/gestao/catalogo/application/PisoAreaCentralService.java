package br.com.redeasso.gestao.catalogo.application;

import br.com.redeasso.gestao.catalogo.api.PisoResponse;
import br.com.redeasso.gestao.integracao.areacentral.AreaCentralProperties;
import br.com.redeasso.gestao.integracao.areacentral.application.*;
import org.springframework.stereotype.Service;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Semaphore;
import static br.com.redeasso.gestao.integracao.areacentral.application.AreaCentralProductException.Code.*;

@Service
public class PisoAreaCentralService {
    private final PisoService pisos;
    private final PisoAreaCentralWriter writer;
    private final AreaCentralProductClient client;
    private final AreaCentralSessionStore sessions;
    private final AreaCentralProperties properties;
    private final PisoCadastroAreaCentralReader cadastroReader;
    private final Semaphore queries = new Semaphore(2);
    public PisoAreaCentralService(PisoService pisos, PisoAreaCentralWriter writer, AreaCentralProductClient client,
                                  AreaCentralSessionStore sessions, AreaCentralProperties properties,
                                  PisoCadastroAreaCentralReader cadastroReader) {
        this.pisos = pisos; this.writer = writer; this.client = client; this.sessions = sessions; this.properties = properties;
        this.cadastroReader = cadastroReader;
    }
    public br.com.redeasso.gestao.catalogo.api.PisoConsultaAreaCentralResponse consultarCadastro(String codigo, String sessionId) {
        if (!properties.enabled()) throw new AreaCentralProductException(UPSTREAM_UNAVAILABLE);
        var cookies = sessions.find(sessionId).orElseThrow(() -> new AreaCentralProductException(SESSION_REQUIRED));
        if (!queries.tryAcquire()) throw new AreaCentralProductException(BUSY);
        try {
            return cadastroReader.preparar(codigo, client.consultar(codigo, cookies));
        } catch (AreaCentralProductException exception) {
            if (exception.code() == SESSION_EXPIRED) sessions.remove(sessionId);
            throw exception;
        } finally { queries.release(); }
    }
    public List<Result> atualizar(List<Long> ids, String sessionId) {
        if (!properties.enabled()) throw new AreaCentralProductException(UPSTREAM_UNAVAILABLE);
        AreaCentralCookieJar cookies = sessions.find(sessionId).orElseThrow(() -> new AreaCentralProductException(SESSION_REQUIRED));
        List<Result> results = new ArrayList<>();
        boolean expired = false;
        for (long id : ids.stream().distinct().toList()) {
            if (expired) { results.add(new Result(id, "FAILED", null, SESSION_EXPIRED.name())); continue; }
            boolean acquired = false;
            try {
                var piso = pisos.buscarPorId(id);
                if (piso.getCodigoRede() == null) {
                    results.add(new Result(id, "MANUAL", PisoResponse.from(piso), null)); continue;
                }
                acquired = queries.tryAcquire();
                if (!acquired) throw new AreaCentralProductException(BUSY);
                var product = client.consultar(piso.getCodigoRede(), cookies);
                var updated = writer.atualizar(id, piso.getCodigoRede(), product);
                results.add(new Result(id, product.encontrado() ? "UPDATED" : "NOT_FOUND", PisoResponse.from(updated), null));
            } catch (AreaCentralProductException exception) {
                if (exception.code() == SESSION_EXPIRED) { expired = true; sessions.remove(sessionId); }
                results.add(new Result(id, "FAILED", null, exception.code().name()));
            } catch (PisoNaoEncontradoException exception) {
                results.add(new Result(id, "FAILED", null, "PISO_NOT_FOUND"));
            } finally { if (acquired) queries.release(); }
        }
        return results;
    }
    public void atualizarParaCalculo(Long id, String codigo, String sessionId) {
        // O acesso local de desenvolvimento ainda permite cálculos manuais, sem conta externa global.
        if (!properties.enabled() || !sessions.hasSession(sessionId)) return;
        var piso = id == null ? pisos.buscarPorCodigo(codigo) : pisos.buscarPorId(id);
        if (piso.getCodigoRede() == null) return;
        var result = atualizar(List.of(piso.getId()), sessionId).getFirst();
        if ("FAILED".equals(result.status())) {
            AreaCentralProductException.Code code;
            try { code = AreaCentralProductException.Code.valueOf(result.code()); }
            catch (IllegalArgumentException ignored) { code = UPSTREAM_UNAVAILABLE; }
            throw new AreaCentralProductException(code);
        }
    }
    public record Result(long id, String status, PisoResponse piso, String code) {}
}
