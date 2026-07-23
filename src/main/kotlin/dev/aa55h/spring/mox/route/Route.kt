package dev.aa55h.spring.mox.route

import dev.aa55h.spring.mox.util.TypeInformation
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.RequestMethod

class Route(
    var id: String,
    var annotation: String,
    var cacheKey: Array<String>,
    var path: Set<String>,
    var method: Set<RequestMethod>,
    var invalidates: Array<String>? = null,
    var parameters: List<Parameter> = emptyList(),
    var parts: List<RequestPart> = emptyList(),
    var requestBody: RequestBody? = null,
    var responses: List<Response> = listOf(Response(HttpStatus.OK.value(), null, emptySet())),
)

data class Response(
    val statusCode: Int,
    val type: TypeInformation?,
    val contentTypes: Set<String>,
)

data class RequestPart(
    val name: String,
    val type: TypeInformation,
    val required: Boolean,
)

data class RequestBody(
    val type: TypeInformation,
    val required: Boolean,
    val contentTypes: Set<String>,
)

data class Parameter(
    val name: String,
    val location: ParameterLocation,
    val type: TypeInformation,
    val required: Boolean,
    val defaultValue: String? = null,
)

enum class ParameterLocation { QUERY, HEADER, PATH }
