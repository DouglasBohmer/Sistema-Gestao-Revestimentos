package br.com.redeasso.gestao.integracao.areacentral.infrastructure;

import br.com.redeasso.gestao.integracao.areacentral.application.AreaCentralCookie;
import br.com.redeasso.gestao.integracao.areacentral.application.AreaCentralCookieJar;
import br.com.redeasso.gestao.integracao.areacentral.application.AreaCentralSessionStore;
import jakarta.servlet.http.HttpSession;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import tools.jackson.databind.ObjectMapper;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Base64;
import java.util.List;
import java.util.Optional;

/** Persiste somente o envelope AES-GCM na sessão JDBC, isolado por ID e limitado a 12 horas. */
public final class HttpSessionAreaCentralSessionStore implements AreaCentralSessionStore {
    static final String ATTRIBUTE = "redeasso.area-central.encrypted-cookies";
    private static final Duration LIFETIME = Duration.ofHours(12);
    private final SecretKeySpec key;
    private final ObjectMapper mapper;
    private final Clock clock;
    private final SecureRandom random = new SecureRandom();

    public HttpSessionAreaCentralSessionStore(String encodedKey, ObjectMapper mapper) {
        this(encodedKey, mapper, Clock.systemUTC());
    }

    HttpSessionAreaCentralSessionStore(String encodedKey, ObjectMapper mapper, Clock clock) {
        byte[] bytes;
        try {
            bytes = Base64.getDecoder().decode(encodedKey);
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException("AREA_CENTRAL_SESSION_ENCRYPTION_KEY deve conter 32 bytes em Base64");
        }
        if (bytes.length != 32) {
            throw new IllegalArgumentException("AREA_CENTRAL_SESSION_ENCRYPTION_KEY deve conter 32 bytes em Base64");
        }
        this.key = new SecretKeySpec(bytes, "AES");
        Arrays.fill(bytes, (byte) 0);
        this.mapper = mapper;
        this.clock = clock;
    }

    @Override
    public void save(String applicationSessionId, AreaCentralCookieJar cookieJar) {
        HttpSession session = session(applicationSessionId)
                .orElseThrow(() -> new IllegalStateException("Sessão da aplicação indisponível"));
        byte[] plain = null;
        try {
            var payload = mapper.createObjectNode();
            payload.put("expiresAt", clock.instant().plus(LIFETIME).toEpochMilli());
            var items = payload.putArray("cookies");
            for (AreaCentralCookie cookie : cookieJar.cookies()) {
                var item = items.addObject();
                item.put("name", cookie.name());
                item.put("value", cookie.value());
                item.put("domain", cookie.domain());
                item.put("path", cookie.path());
                item.put("secure", cookie.secure());
                item.put("httpOnly", cookie.httpOnly());
                item.put("sameSite", cookie.sameSite());
                if (cookie.expiresAt() != null) item.put("expiresAt", cookie.expiresAt().toEpochMilli());
            }
            plain = mapper.writeValueAsBytes(payload);
            byte[] iv = new byte[12];
            random.nextBytes(iv);
            Cipher cipher = cipher(Cipher.ENCRYPT_MODE, iv, applicationSessionId);
            byte[] encrypted = cipher.doFinal(plain);
            byte[] envelope = new byte[iv.length + encrypted.length];
            System.arraycopy(iv, 0, envelope, 0, iv.length);
            System.arraycopy(encrypted, 0, envelope, iv.length, encrypted.length);
            session.setAttribute(ATTRIBUTE, "v1." + Base64.getEncoder().encodeToString(envelope));
        } catch (Exception exception) {
            throw new IllegalStateException("Não foi possível proteger a sessão da Área Central");
        } finally {
            if (plain != null) Arrays.fill(plain, (byte) 0);
        }
    }

    @Override
    public boolean hasSession(String applicationSessionId) {
        return find(applicationSessionId).isPresent();
    }

    @Override
    public Optional<AreaCentralCookieJar> find(String applicationSessionId) {
        Optional<HttpSession> current = session(applicationSessionId);
        if (current.isEmpty()) return Optional.empty();
        Object stored = current.get().getAttribute(ATTRIBUTE);
        if (!(stored instanceof String encoded) || !encoded.startsWith("v1.")) return Optional.empty();
        byte[] plain = null;
        try {
            byte[] envelope = Base64.getDecoder().decode(encoded.substring(3));
            if (envelope.length < 28) throw new IllegalArgumentException();
            Cipher cipher = cipher(Cipher.DECRYPT_MODE, Arrays.copyOfRange(envelope, 0, 12), applicationSessionId);
            plain = cipher.doFinal(envelope, 12, envelope.length - 12);
            var payload = mapper.readTree(plain);
            Instant expiresAt = Instant.ofEpochMilli(payload.path("expiresAt").asLong(0));
            if (!expiresAt.isAfter(clock.instant())) {
                remove(applicationSessionId);
                return Optional.empty();
            }
            List<AreaCentralCookie> cookies = new ArrayList<>();
            for (var item : payload.path("cookies")) {
                Instant expiry = item.hasNonNull("expiresAt") ? Instant.ofEpochMilli(item.path("expiresAt").asLong()) : null;
                if (expiry != null && !expiry.isAfter(clock.instant())) continue;
                cookies.add(new AreaCentralCookie(item.path("name").asText(), item.path("value").asText(),
                        item.path("domain").asText(), item.path("path").asText(), item.path("secure").asBoolean(),
                        item.path("httpOnly").asBoolean(), item.path("sameSite").asText(), expiry));
            }
            AreaCentralCookieJar jar = new AreaCentralCookieJar(cookies);
            if (jar.hasAuthenticatedSessionCookie()) return Optional.of(jar);
        } catch (Exception ignored) {
            // Chave trocada, envelope adulterado ou sessão expirada exigem novo login.
            // Nenhum texto da exceção, cookie ou payload vai para logs.
        } finally {
            if (plain != null) Arrays.fill(plain, (byte) 0);
        }
        remove(applicationSessionId);
        return Optional.empty();
    }

    @Override
    public void remove(String applicationSessionId) {
        session(applicationSessionId).ifPresent(current -> current.removeAttribute(ATTRIBUTE));
    }

    private Cipher cipher(int mode, byte[] iv, String sessionId) throws Exception {
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(mode, key, new GCMParameterSpec(128, iv));
        cipher.updateAAD(("redeasso-area-central-v1:" + sessionId).getBytes(StandardCharsets.UTF_8));
        return cipher;
    }

    private Optional<HttpSession> session(String sessionId) {
        if (sessionId == null || !(RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attributes)) {
            return Optional.empty();
        }
        HttpSession session = attributes.getRequest().getSession(false);
        return session != null && sessionId.equals(session.getId()) ? Optional.of(session) : Optional.empty();
    }
}
