package dev.aa55h.spring.mox

import org.springframework.boot.context.properties.ConfigurationProperties
import org.springframework.context.annotation.Configuration

/**
 * Configuration properties for Mox library.
 */
@Configuration
@ConfigurationProperties(prefix = "mox")
class MoxAutoConfiguration {
    /**
     * Enable Spring Mox
     */
    var enabled: Boolean = true

    /**
     * Output path for routes.json format file
     */
    var outputPath: String = "./routes.json"

    /**
     * The packages to exclude route scanning from
     */
    var packages: List<String> = emptyList()

    /**
     * Optional prefixes configuration
     */
    var prefixes: Prefixes = Prefixes()

    /**
     * Prefixes used in [dev.aa55h.spring.mox.route.DefaultRouteConfigurer] for building a cache key.
     * @param path The string used in query key to prefix a path parameter.
     * @param query The string used in query key to prefix a query parameter.
     */
    data class Prefixes(
        var path: String = "path:",
        var query: String = "query:"
    )
}