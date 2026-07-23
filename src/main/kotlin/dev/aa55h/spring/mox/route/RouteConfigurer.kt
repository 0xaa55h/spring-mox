package dev.aa55h.spring.mox.route

import org.springframework.web.method.HandlerMethod
import org.springframework.web.servlet.mvc.method.RequestMappingInfo

interface RouteConfigurer {
    fun configure(builder: RouteBuilder, mappingInfo: RequestMappingInfo, handlerMethod: HandlerMethod)
}
