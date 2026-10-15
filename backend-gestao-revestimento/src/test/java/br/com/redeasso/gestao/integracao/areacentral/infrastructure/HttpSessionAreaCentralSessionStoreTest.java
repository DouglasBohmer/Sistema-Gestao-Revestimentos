package br.com.redeasso.gestao.integracao.areacentral.infrastructure;

import br.com.redeasso.gestao.integracao.areacentral.application.AreaCentralCookie;
import br.com.redeasso.gestao.integracao.areacentral.application.AreaCentralCookieJar;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import tools.jackson.databind.json.JsonMapper;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Base64;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class HttpSessionAreaCentralSessionStoreTest {
    private static final String KEY = Base64.getEncoder().encodeToString(new byte[32]);
    private static final Instant NOW = Instant.parse("2026-10-15T10:00:00Z");

    @AfterEach
    void limpaContexto() { RequestContextHolder.resetRequestAttributes(); }

    @Test
    void preservaCookiesAposRecriarStoreSemPersisitirTextoEmClaro() {
        var session = bindSession();
        storeAt(NOW).save(session.getId(), jar(null));
        String envelope = (String) session.getAttribute(HttpSessionAreaCentralSessionStore.ATTRIBUTE);
        assertThat(envelope).startsWith("v1.").doesNotContain("PHPSESSID", "cookie-secreto-teste");
        assertThat(storeAt(NOW.plusSeconds(30)).find(session.getId()).orElseThrow().cookies().getFirst().value())
                .isEqualTo("cookie-secreto-teste");
    }

    @Test
    void expiraExatamenteEmDozeHorasSemProlongarPeloUso() {
        var session = bindSession();
        storeAt(NOW).save(session.getId(), jar(null));
        assertThat(storeAt(NOW.plus(Duration.ofHours(11))).hasSession(session.getId())).isTrue();
        assertThat(storeAt(NOW.plus(Duration.ofHours(12))).hasSession(session.getId())).isFalse();
        assertThat(session.getAttribute(HttpSessionAreaCentralSessionStore.ATTRIBUTE)).isNull();
    }

    @Test
    void cookieExternoExpiradoExigeNovoLoginMesmoAntesDasDozeHoras() {
        var session = bindSession();
        storeAt(NOW).save(session.getId(), jar(NOW.plusSeconds(10)));
        assertThat(storeAt(NOW.plusSeconds(10)).hasSession(session.getId())).isFalse();
    }

    @Test
    void envelopeCopiadoParaOutraSessaoNaoAutentica() {
        var first = bindSession();
        storeAt(NOW).save(first.getId(), jar(null));
        Object envelope = first.getAttribute(HttpSessionAreaCentralSessionStore.ATTRIBUTE);
        var other = bindSession();
        other.setAttribute(HttpSessionAreaCentralSessionStore.ATTRIBUTE, envelope);
        assertThat(storeAt(NOW).hasSession(other.getId())).isFalse();
        assertThat(other.getAttribute(HttpSessionAreaCentralSessionStore.ATTRIBUTE)).isNull();
    }

    @Test
    void chaveTrocadaRevogaCookieJarESairRemoveEnvelope() {
        var session = bindSession();
        storeAt(NOW).save(session.getId(), jar(null));
        byte[] otherKey = new byte[32];
        otherKey[0] = 1;
        var rotated = new HttpSessionAreaCentralSessionStore(Base64.getEncoder().encodeToString(otherKey), JsonMapper.builder().build());
        assertThat(rotated.hasSession(session.getId())).isFalse();
        storeAt(NOW).save(session.getId(), jar(null));
        storeAt(NOW).remove(session.getId());
        assertThat(storeAt(NOW).hasSession(session.getId())).isFalse();
    }

    private MockHttpSession bindSession() {
        var request = new MockHttpServletRequest();
        var session = new MockHttpSession();
        request.setSession(session);
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));
        return session;
    }

    private HttpSessionAreaCentralSessionStore storeAt(Instant instant) {
        return new HttpSessionAreaCentralSessionStore(KEY, JsonMapper.builder().build(), Clock.fixed(instant, ZoneOffset.UTC));
    }

    private AreaCentralCookieJar jar(Instant expiresAt) {
        return new AreaCentralCookieJar(List.of(new AreaCentralCookie("PHPSESSID", "cookie-secreto-teste",
                "redeasso.areacentral.com.br", "/", true, true, "Lax", expiresAt)));
    }
}
