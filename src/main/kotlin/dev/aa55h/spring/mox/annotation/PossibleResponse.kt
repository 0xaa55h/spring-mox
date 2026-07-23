package dev.aa55h.spring.mox.annotation

import org.springframework.http.HttpStatus
import kotlin.reflect.KClass

/**
 * Specifies the possible response of the route.
 * @param status the HTTP status of the response
 * @param type the type of the returning object
 * @param contentType content type
 */
@Repeatable
@Retention(AnnotationRetention.RUNTIME)
@Target(AnnotationTarget.FUNCTION)
annotation class PossibleResponse(
    val status: HttpStatus,
    val type: KClass<*>,
    val contentType: Array<String> = []
)
