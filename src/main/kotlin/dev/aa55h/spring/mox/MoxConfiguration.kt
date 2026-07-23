package dev.aa55h.spring.mox

import com.github.victools.jsonschema.generator.OptionPreset
import com.github.victools.jsonschema.generator.SchemaGenerator
import com.github.victools.jsonschema.generator.SchemaGeneratorConfig
import com.github.victools.jsonschema.generator.SchemaGeneratorConfigBuilder
import com.github.victools.jsonschema.generator.SchemaVersion
import com.github.victools.jsonschema.module.jackson.JacksonOption
import com.github.victools.jsonschema.module.jackson.JacksonSchemaModule
import com.github.victools.jsonschema.module.jakarta.validation.JakartaValidationModule
import com.github.victools.jsonschema.module.jakarta.validation.JakartaValidationOption
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration

@Configuration
class MoxConfiguration {
    @Bean
    fun schemaGeneratorConfig(): SchemaGeneratorConfig {
        val builder = SchemaGeneratorConfigBuilder(SchemaVersion.DRAFT_2020_12, OptionPreset.PLAIN_JSON)
            .with(JakartaValidationModule(JakartaValidationOption.NOT_NULLABLE_FIELD_IS_REQUIRED,
                JakartaValidationOption.INCLUDE_PATTERN_EXPRESSIONS))
            .with(JacksonSchemaModule(JacksonOption.RESPECT_JSONPROPERTY_ORDER, JacksonOption.FLATTENED_ENUMS_FROM_JSONVALUE,
                JacksonOption.FLATTENED_ENUMS_FROM_JSONPROPERTY))
        builder.forTypesInGeneral()
            .withTitleResolver { scope -> scope.type.erasedType.simpleName }
        return builder.build()
    }

    @Bean
    fun schemaGenerator(config: SchemaGeneratorConfig): SchemaGenerator {
        return SchemaGenerator(config)
    }
}