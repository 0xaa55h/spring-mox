package dev.aa55h.spring.mox.annotation

/**
 * Overrides a route's id. By default, the id is inferred from the handler function's name;
 * use this when the function name isn't a stable/suitable public identifier.
 */
@Retention(AnnotationRetention.RUNTIME)
@Target(AnnotationTarget.FUNCTION)
annotation class RouteId(val id: String)
