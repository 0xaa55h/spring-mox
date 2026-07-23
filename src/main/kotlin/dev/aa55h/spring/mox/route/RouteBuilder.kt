package dev.aa55h.spring.mox.route

import com.github.victools.jsonschema.generator.SchemaBuilder
import dev.aa55h.spring.mox.util.toTypeInformation
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.RequestMethod
import java.lang.reflect.Type

@DslMarker
annotation class RouteDsl

@RouteDsl
class RouteBuilder(private val schemaBuilder: SchemaBuilder) {
    private var id: String = ""
    private var annotation: String = ""
    private var cacheKey = arrayOf<String>()
    private var invalidates: Array<String>? = null
    private val paths = mutableSetOf<String>()
    private val methods = mutableSetOf<RequestMethod>()
    private val parameters = mutableListOf<Parameter>()
    private val parts = mutableListOf<RequestPart>()
    private var requestBody: RequestBody? = null
    private val responses = mutableListOf<Response>()

    fun id(value: String) {
        id = value
    }

    fun annotation(value: String) {
        annotation = value
    }

    fun cacheKey(key: Array<String>) {
        cacheKey = key
    }

    fun path(vararg values: String) {
        paths += values
    }

    fun method(vararg values: RequestMethod) {
        methods += values
    }

    fun invalidates(values: Array<String>?) {
        invalidates = values
    }

    fun queryParam(
        name: String,
        type: Type,
        required: Boolean = false,
        defaultValue: String? = null,
    ) {
        parameters += Parameter(name, ParameterLocation.QUERY, type.toTypeInformation(schemaBuilder), required, defaultValue)
    }

    fun headerParam(
        name: String,
        type: Type,
        required: Boolean = false,
        defaultValue: String? = null,
    ) {
        parameters += Parameter(name, ParameterLocation.HEADER, type.toTypeInformation(schemaBuilder), required, defaultValue)
    }

    fun pathParam(name: String, type: Type) {
        // Path parameters are always required and can't have defaults
        parameters += Parameter(name, ParameterLocation.PATH, type.toTypeInformation(schemaBuilder), required = true)
    }

    fun part(name: String, type: Type, required: Boolean = true) {
        parts += RequestPart(name, type.toTypeInformation(schemaBuilder), required)
    }

    fun body(
        type: Type,
        required: Boolean = true,
        vararg contentTypes: String,
    ) {
        val types = if (contentTypes.isEmpty()) setOf("application/json") else contentTypes.toSet()
        requestBody = RequestBody(type.toTypeInformation(schemaBuilder), required, types)
    }

    fun response(
        statusCode: Int,
        type: Type? = null,
        vararg contentTypes: String,
    ) {
        responses += Response(statusCode, type?.toTypeInformation(schemaBuilder), contentTypes.toSet())
    }

    fun build(): Route {
        require(id.isNotBlank()) { "Route must declare a valid id" }
        require(annotation.isNotBlank()) { "Route must declare a valid annotation" }
        require(cacheKey.isNotEmpty()) { "Route must declare a valid cache key" }
        require(paths.isNotEmpty()) { "Route must declare at least one path" }
        require(methods.isNotEmpty()) { "Route must declare at least one HTTP method" }

        return Route(
            id = id,
            annotation = annotation,
            cacheKey = cacheKey,
            path = paths.toSet(),
            method = methods.toSet(),
            parameters = parameters.toList(),
            invalidates = invalidates,
            parts = parts.toList(),
            requestBody = requestBody,
            responses = responses.ifEmpty { listOf(Response(HttpStatus.OK.value(), null, emptySet())) },
        )
    }
}

fun route(schemaBuilder: SchemaBuilder, init: RouteBuilder.() -> Unit): Route = RouteBuilder(schemaBuilder).apply(init).build()