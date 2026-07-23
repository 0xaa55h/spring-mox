package dev.aa55h.spring.mox

import org.springframework.boot.context.properties.ConfigurationProperties
import org.springframework.context.annotation.Configuration

/**
 * Configuration properties for Mox library.
 * @param enabled Whether to enable the route generation.
 * @param outputPath The path to output route information.
 * @param packages The packages to match rest controllers against. Empty means to match all controllers (even the default "/error").
 */
@Configuration
@ConfigurationProperties(prefix = "mox")
data class MoxConfigurationProperties(
    val enabled: Boolean = true,
    val outputPath: String = "./routes.json",
    val packages: List<String> = emptyList(),
    val prefixes: Prefixes = Prefixes()
) {
    /**
     * Prefixes used in [dev.aa55h.spring.mox.route.DefaultRouteConfigurer] for building a cache key.
     * @param path The string used in query key to prefix a path parameter.
     * @param query The string used in query key to prefix a query parameter.
     */
    data class Prefixes(
        val path: String = "path:",
        val query: String = "query:"
    )
}