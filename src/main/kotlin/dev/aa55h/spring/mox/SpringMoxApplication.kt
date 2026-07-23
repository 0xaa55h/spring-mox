package dev.aa55h.spring.mox

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.boot.runApplication

@SpringBootApplication
@EnableConfigurationProperties(MoxConfigurationProperties::class)
class SpringMoxApplication

fun main(args: Array<String>) {
    runApplication<SpringMoxApplication>(*args)
}
