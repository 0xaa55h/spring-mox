package dev.aa55h.spring.mox.annotation

/**
 * Annotation which marks a REST controller's route as invalidating. This means that calling this route will
 * invalidate data provided by other routes.
 *
 * @param key the key to invalidate provided data
 * @see ClientCacheKey
 */
@Retention(AnnotationRetention.RUNTIME)
@Target(AnnotationTarget.FUNCTION)
annotation class Invalidates(val key: Array<String>)

