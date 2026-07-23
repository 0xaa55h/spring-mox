package dev.aa55h.spring.mox.route

import dev.aa55h.spring.mox.MoxConfigurationProperties
import dev.aa55h.spring.mox.annotation.ClientCacheKey
import dev.aa55h.spring.mox.annotation.Invalidates
import dev.aa55h.spring.mox.annotation.PossibleResponse
import dev.aa55h.spring.mox.annotation.RouteId
import org.springframework.http.HttpMethod
import org.springframework.stereotype.Component
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMethod
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RequestPart
import org.springframework.web.bind.annotation.ValueConstants
import org.springframework.web.method.HandlerMethod
import org.springframework.web.servlet.mvc.method.RequestMappingInfo
import kotlin.reflect.full.findAnnotation
import kotlin.reflect.full.valueParameters
import kotlin.reflect.jvm.javaType
import kotlin.reflect.jvm.kotlinFunction

@Component
class DefaultRouteConfigurer(
    private val configurationProperties: MoxConfigurationProperties
) : RouteConfigurer {

    override fun configure(builder: RouteBuilder, mappingInfo: RequestMappingInfo, handlerMethod: HandlerMethod) {
        val method = handlerMethod.method
        val cacheKeyBase = method.getAnnotation(ClientCacheKey::class.java)?.key
            ?: handlerMethod.beanType.getAnnotation(ClientCacheKey::class.java)?.key
            ?: method.name

        builder.id(method.getAnnotation(RouteId::class.java)?.id ?: method.name)
        builder.annotation("${handlerMethod.beanType.simpleName}#${method.name}")

        builder.path(*mappingInfo.patternValues.toTypedArray())
        builder.method(*mappingInfo.methodsCondition.methods.ifEmpty { RequestMethod.entries.toMutableSet() }.toTypedArray())

        val cacheKey = mutableListOf(cacheKeyBase)

        method.kotlinFunction?.valueParameters?.forEach { parameter ->
            val name = parameter.name
            val type = parameter.type.javaType
            val nullable = parameter.type.isMarkedNullable

            val pathVariable = parameter.findAnnotation<PathVariable>()
            val requestParam = parameter.findAnnotation<RequestParam>()
            val requestHeader = parameter.findAnnotation<RequestHeader>()
            val requestPart = parameter.findAnnotation<RequestPart>()
            val requestBody = parameter.findAnnotation<RequestBody>()

            when {
                pathVariable != null -> {
                    val paramName = pathVariable.value.ifEmpty { name!! }
                    builder.pathParam(paramName, type)
                    cacheKey += "${configurationProperties.prefixes.path}$paramName"
                }
                requestParam != null -> {
                    val paramName = requestParam.name.ifEmpty { name!! }
                    val required = requestParam.required && !nullable
                    val defaultValue = requestParam.defaultValue.takeUnless { it == ValueConstants.DEFAULT_NONE }
                    builder.queryParam(paramName, type, required, defaultValue)
                    cacheKey += "${configurationProperties.prefixes.query}$paramName"
                }
                requestHeader != null -> {
                    val paramName = requestHeader.name.ifEmpty { name!! }
                    val required = requestHeader.required && !nullable
                    val defaultValue = requestHeader.defaultValue.takeUnless { it == ValueConstants.DEFAULT_NONE }
                    builder.headerParam(paramName, type, required, defaultValue)
                }
                requestPart != null -> {
                    val paramName = requestPart.value.ifEmpty { name!! }
                    val required = requestPart.required && !nullable
                    builder.part(paramName, type, required)
                }
                requestBody != null -> {
                    val contentTypes = mappingInfo.consumesCondition.consumableMediaTypes.map { it.toString() }
                    builder.body(type, requestBody.required && !nullable, *contentTypes.toTypedArray())
                }
            }
        }

        builder.cacheKey(cacheKey.toTypedArray())

        method.getAnnotation(Invalidates::class.java)?.let { builder.invalidates(it.key) }

        method.getAnnotationsByType(PossibleResponse::class.java).forEach { response ->
            builder.response(response.status.value(), response.type.java, *response.contentType)
        }
    }
}
