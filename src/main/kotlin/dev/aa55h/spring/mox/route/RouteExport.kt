package dev.aa55h.spring.mox.route

import tools.jackson.databind.node.ObjectNode

data class RouteExport(
    val version: String,
    val routes: List<Route>,
    val schemas: ObjectNode
)
