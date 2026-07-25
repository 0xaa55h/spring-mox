plugins {
    alias(libs.plugins.kotlin.jvm)
    alias(libs.plugins.kotlin.plugin.spring)
    alias(libs.plugins.spring.boot)
    alias(libs.plugins.spring.dependency.management)
    alias(libs.plugins.dokka)
    alias(libs.plugins.nmcp)
    alias(libs.plugins.nmcp.aggregation)
    `maven-publish`
    signing
}

group = "dev.aa55h"
version = "0.1.0"
description = "spring-mox"

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(25)
    }
}

repositories {
    mavenCentral()
}

dependencies {
    nmcpAggregation(project(":"))
    implementation(libs.jsonschema.generator)
    implementation(libs.jsonschema.module.jackson)
    implementation(libs.jsonschema.module.jakarta.validation)
    implementation(libs.jakarta.validation.api)
    implementation(libs.spring.boot.starter.webmvc)
    implementation(libs.kotlin.reflect)
    implementation(libs.jackson.module.kotlin)
    implementation(libs.spring.boot.starter.validation)
    testImplementation(libs.spring.boot.starter.webmvc.test)
    testImplementation(libs.kotlin.test.junit5)
    testRuntimeOnly(libs.junit.platform.launcher)
}

kotlin {
    compilerOptions {
        freeCompilerArgs.addAll("-Xjsr305=strict", "-Xannotation-default-target=param-property")
    }
}

tasks.withType<Test> {
    useJUnitPlatform()
}

tasks.bootJar {
    enabled = false
}

tasks.jar {
    enabled = true
    archiveClassifier.set("")
}

val dokkaJavadocJar by tasks.registering(Jar::class) {
    description = "A Javadoc JAR containing Dokka Javadoc"
    from(tasks.dokkaGeneratePublicationJavadoc.flatMap { it.outputDirectory })
    archiveClassifier.set("javadoc")
}

publishing {
    publications {
        create<MavenPublication>("mavenJava") {
            groupId = "dev.aa55h"
            artifactId = "spring-mox"
            version = project.version as String

            from(components["java"])
            artifact(dokkaJavadocJar)

            versionMapping {
                usage("java-api") {
                    fromResolutionOf("runtimeClasspath")
                }
                usage("java-runtime") {
                    fromResolutionResult()
                }
            }

            pom {
                name = "Spring Mox"
                description = "Library for generating Spring WebMvc route metadata"
                url = "https://github.com/0xaa55h/spring-mox"
                licenses {
                    license {
                        name = "The MIT License (MIT)"
                        url = "https://mit-license.org/"
                    }
                }

                developers {
                    developer {
                        id = "aa55h"
                        name = "Jan Prokůpek"
                        email = "janprokupek04@gmail.com"
                    }
                }

                scm {
                    connection = "scm:git:git://github.com/0xaa55h/spring-mox.git"
                    developerConnection = "scm:git:ssh://github.com:0xaa55h/spring-mox.git"
                    url = "https://github.com/0xaa55h/spring-mox"
                }
            }
        }
    }
    repositories {
        mavenLocal()
    }
}

java {
    withSourcesJar()
}

signing {
    val signingKey = providers.environmentVariable("GPG_SIGNING_KEY")
    val signingPassphrase = providers.environmentVariable("GPG_SIGNING_PASSPHRASE")
    useInMemoryPgpKeys(signingKey.getOrElse(""), signingPassphrase.getOrElse(""))
    sign(publishing.publications["mavenJava"])
}

nmcpAggregation {
    centralPortal {
        username = providers.environmentVariable("CENTRAL_USERNAME").getOrElse("")
        password = providers.environmentVariable("CENTRAL_PASSWORD").getOrElse("")
        publishingType = "USER_MANAGED"
    }
}