package br.com.redeasso.gestao.integracao.areacentral.application;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;

/**
 * Emite uma capacidade curta para o gateway noVNC. O token é verificável
 * somente pelo serviço do navegador; ele não contém senha, cookies ou chave
 * de serviço e deixa de funcionar na expiração ou quando a tentativa é revogada.
 */
final class AreaCentralInteractiveAccessToken {

    private AreaCentralInteractiveAccessToken() {
    }

    static String issue(String interactiveUrl, String secret, String accessId, Instant expiresAt) {
        String payload = Base64.getUrlEncoder().withoutPadding().encodeToString(
                (accessId + "\n" + expiresAt.getEpochSecond()).getBytes(StandardCharsets.UTF_8));
        String signature = Base64.getUrlEncoder().withoutPadding().encodeToString(hmac(payload, secret));
        String token = "v1." + payload + "." + signature;
        String path = "websockify?token=" + token;
        String separator = interactiveUrl.contains("?") ? "&" : "?";
        return interactiveUrl + separator
                + "autoconnect=1&resize=remote&path="
                + URLEncoder.encode(path, StandardCharsets.UTF_8).replace("+", "%20");
    }

    private static byte[] hmac(String payload, String secret) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return mac.doFinal(payload.getBytes(StandardCharsets.US_ASCII));
        } catch (Exception exception) {
            throw new IllegalStateException("Não foi possível assinar o acesso ao navegador isolado", exception);
        }
    }
}
