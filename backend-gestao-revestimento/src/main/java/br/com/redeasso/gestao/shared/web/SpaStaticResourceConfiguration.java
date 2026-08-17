package br.com.redeasso.gestao.shared.web;

import java.io.IOException;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.Resource;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.servlet.resource.PathResourceResolver;

/**
 * Serve o bundle React incorporado ao JAR e encaminha rotas do navegador para
 * o index da SPA. Caminhos reservados à API e ao Actuator nunca recebem esse
 * fallback, evitando transformar um 404 de API em uma página HTML.
 */
@Configuration(proxyBeanMethods = false)
public class SpaStaticResourceConfiguration implements WebMvcConfigurer {

    private static final String STATIC_LOCATION = "classpath:/static/";

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/**")
                .addResourceLocations(STATIC_LOCATION)
                .resourceChain(true)
                .addResolver(new SpaPageResourceResolver());
    }

    private static final class SpaPageResourceResolver extends PathResourceResolver {

        @Override
        protected Resource getResource(String resourcePath, Resource location) throws IOException {
            Resource resource = super.getResource(resourcePath, location);
            if (resource != null) {
                return resource;
            }

            if (isSpaRoute(resourcePath)) {
                return super.getResource("index.html", location);
            }

            return null;
        }

        private boolean isSpaRoute(String resourcePath) {
            return !resourcePath.contains(".")
                    && !isReservedPath(resourcePath, "api")
                    && !isReservedPath(resourcePath, "actuator");
        }

        private boolean isReservedPath(String resourcePath, String segment) {
            return resourcePath.equals(segment) || resourcePath.startsWith(segment + "/");
        }
    }
}
