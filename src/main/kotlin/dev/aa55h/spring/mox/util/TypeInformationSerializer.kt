package dev.aa55h.spring.mox.util

import com.github.victools.jsonschema.generator.SchemaBuilder
import org.springframework.stereotype.Component
import tools.jackson.core.JsonGenerator
import tools.jackson.databind.SerializationContext
import tools.jackson.databind.ValueSerializer
import java.lang.reflect.Type

/**
 * Custom serializer for [TypeInformation] classes, which will convert them to JSON object schemas.
 */
@Component
class TypeInformationSerializer: ValueSerializer<TypeInformation>() {
    override fun serialize(
        value: TypeInformation,
        gen: JsonGenerator,
        ctxt: SerializationContext
    ) {
        gen.writeTree(value.objectNode)
    }

    override fun handledType(): Class<*> = TypeInformation::class.java
}