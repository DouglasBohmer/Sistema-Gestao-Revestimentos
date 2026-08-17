package br.com.redeasso.gestao.auth.infrastructure.security;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.ProviderManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;

@Configuration(proxyBeanMethods = false)
@ConditionalOnProperty(
        prefix = "redeasso.auth.local",
        name = "enabled",
        havingValue = "true",
        matchIfMissing = true)
@EnableConfigurationProperties(LocalAdminProperties.class)
public class LocalAdminConfiguration {

    @Bean
    PasswordEncoder passwordEncoder() {
        return PasswordEncoderFactories.createDelegatingPasswordEncoder();
    }

    @Bean
    UserDetailsService localAdminUserDetailsService(
            LocalAdminProperties properties,
            PasswordEncoder passwordEncoder) {
        requireConfigured(properties);

        UserDetails admin = User.withUsername(properties.getUsername())
                .password(passwordEncoder.encode(properties.getPassword()))
                .roles("ADMIN")
                .build();
        return new InMemoryUserDetailsManager(admin);
    }

    @Bean
    AuthenticationManager localAuthenticationManager(
            UserDetailsService userDetailsService,
            PasswordEncoder passwordEncoder) {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider(userDetailsService);
        provider.setPasswordEncoder(passwordEncoder);
        return new ProviderManager(provider);
    }

    private static void requireConfigured(LocalAdminProperties properties) {
        if (properties.getUsername() == null || properties.getUsername().isBlank()) {
            throw new IllegalStateException("redeasso.auth.local.username não pode ficar vazio");
        }
        if (properties.getPassword() == null || properties.getPassword().isBlank()) {
            throw new IllegalStateException("redeasso.auth.local.password não pode ficar vazio");
        }
    }
}
