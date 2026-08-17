package br.com.redeasso.gestao.integracao.areacentral;

import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import java.net.URI;
import java.time.Duration;

@Validated
@ConfigurationProperties("redeasso.integration.area-central")
public record AreaCentralProperties(
        boolean enabled,
        @NotNull URI baseUrl,
        @NotNull Duration connectTimeout,
        @NotNull Duration readTimeout
) {
    public AreaCentralProperties {
        requirePositive(connectTimeout, "connect-timeout");
        requirePositive(readTimeout, "read-timeout");
    }

    private static void requirePositive(Duration duration, String propertyName) {
        if (duration != null && (duration.isZero() || duration.isNegative())) {
            throw new IllegalArgumentException(
                    "redeasso.integration.area-central.%s deve ser positivo".formatted(propertyName));
        }
    }
}
