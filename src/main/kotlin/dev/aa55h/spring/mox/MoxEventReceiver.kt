package dev.aa55h.spring.mox

import com.github.victools.jsonschema.generator.SchemaBuilder
import com.github.victools.jsonschema.generator.SchemaGenerator
import com.github.victools.jsonschema.generator.SchemaVersion
import dev.aa55h.spring.mox.route.RouteBuilder
import dev.aa55h.spring.mox.route.RouteConfigurer
import dev.aa55h.spring.mox.route.RouteExport
import dev.aa55h.spring.mox.util.TypeInformationSerializer
import org.slf4j.Logger
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.getBean
import org.springframework.context.event.ContextRefreshedEvent
import org.springframework.context.event.EventListener
import org.springframework.stereotype.Component
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping
import tools.jackson.databind.ObjectMapper
import tools.jackson.databind.json.JsonMapper
import tools.jackson.databind.module.SimpleModule
import java.io.File

@Component
class MoxEventReceiver(
    val configurationProperties: MoxAutoConfiguration,
    objectMapper: ObjectMapper,
    schemaGenerator: SchemaGenerator,
    typeInformationSerializer: TypeInformationSerializer,
    private val routeConfigurers: List<RouteConfigurer>
) {
    private val logger: Logger = LoggerFactory.getLogger(MoxEventReceiver::class.java)

    init {
        if (configurationProperties.enabled) {
            logger.info("Mox event receiver is active. Route data generation on ${configurationProperties.outputPath}")
        }
    }

    val version: SchemaVersion = schemaGenerator.config.schemaVersion
    val builder: SchemaBuilder = schemaGenerator.buildMultipleSchemaDefinitions()
    val mapper: JsonMapper = objectMapper.rebuild<JsonMapper, JsonMapper.Builder>()
        .addModule(SimpleModule().addSerializer(typeInformationSerializer))
        .build()

    @EventListener
    fun on(event: ContextRefreshedEvent) {
        if (!configurationProperties.enabled) return
        logger.info("Regenerating route data...")
        val requestMappingHandlerMapping = event.applicationContext.getBean<RequestMappingHandlerMapping>("requestMappingHandlerMapping")
        val routes = requestMappingHandlerMapping.handlerMethods
            .filter { pair -> configurationProperties.packages.isEmpty()
                    || configurationProperties.packages.any { pair.value.beanType.name.startsWith(it) } }
            .mapNotNull{ (mappingInfo, handlerMethod) ->
                val routeBuilder = RouteBuilder(builder)
                routeConfigurers.forEach { it.configure(routeBuilder, mappingInfo, handlerMethod) }
                runCatching { routeBuilder.build() }.getOrElse {
                    logger.error("Failed to generate route data for ${handlerMethod.beanType.simpleName}#${handlerMethod.method.name}: ${it.message}", it)
                    return@getOrElse null
                }
            }
        val definitions = builder.collectDefinitions($$"$defs")
        logger.info("Done with ${routes.size} routes (side generated ${definitions.size()} definitions)")

        mapper.writerWithDefaultPrettyPrinter().writeValue(
            File(configurationProperties.outputPath),
            RouteExport(
                version.identifier,
                routes,
                definitions
            )
        )
    }
}
