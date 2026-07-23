package dev.aa55h.spring.mox.util

import com.github.victools.jsonschema.generator.SchemaBuilder
import tools.jackson.databind.node.ObjectNode
import java.lang.reflect.Type

data class TypeInformation(val type: Type, val objectNode: ObjectNode)

fun Type.toTypeInformation(schemaBuilder: SchemaBuilder): TypeInformation {
    return TypeInformation(this, schemaBuilder.createSchemaReference(this))
}