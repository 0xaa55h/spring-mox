package dev.aa55h.spring.mox.annotation

/**
 * Allows to specify a custom client sided cache key base. This, however, does not omit remaining query and path parameters
 * for the route itself. It can also be applied to a class, in such case, it replaces all cache key bases in all routes for the controller.
 * If individual route specifies the key base, it takes precedence over the class cache key base.
 * #### Example 1
 * ```kt
 * @ClientCacheKey(key = "data1")
 * @GetMapping("/items")
 * fun getData1() {
 *   // ...
 * } // -> Client cache key: ["data1"]
 * ```
 * #### Example 2
 * ```kt
 * @ClientCacheKey(key = "data2")
 * @GetMapping("/items/:id")
 * fun getData2() {
 *   // ...
 * } // -> Client cache key: ["data2", "path:<id>"]
 * ```
 * #### Example 3
 * ```kt
 * @ClientCacheKey(key = "data3")
 * @GetMapping("/items")
 * fun getData3(@RequestParam id: String) {
 *   // ...
 * } // -> Client cache key: ["data3", "query:<id>"]
 * ```
 * #### Example 4
 * ```kt
 * @RestController
 * @ClientCacheKey(key = "data4")
 * class ItemController {
 *   @GetMapping("/items")
 *   fun getData4() {
 *     // ...
 *   } // -> Client cache key: ["data4"]
 * }
 * ```
 *
 * In other words, this overrides only **the name of the cache key base**.
 */
@Retention(AnnotationRetention.RUNTIME)
@Target(AnnotationTarget.FUNCTION, AnnotationTarget.CLASS)
annotation class ClientCacheKey(val key: String)
