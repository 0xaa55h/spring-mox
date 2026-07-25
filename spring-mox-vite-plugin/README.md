# @spring-mox/vite-plugin-react

Vite plugin for [Spring Mox](https://github.com/0xaa55h/spring-mox) that generates type-safe routes
from Spring WebMvc metadata (`routes.json`) via [`@spring-mox/base`](../spring-mox-base), on every
Vite config resolve. Requires the [Bun](https://bun.sh/) runtime.

## Install

```sh
bun add -D @spring-mox/vite-plugin-react
```

## Usage

```typescript
import { defineConfig } from "vite";
import springMox from "@spring-mox/vite-plugin-react";

export default defineConfig({
  plugins: [
    springMox({
      input: Bun.file("./routes.json"),
      output: Bun.file("./src/generated"),
    }),
  ],
});
```

### Options

| Option       | Type                                                          | Default                                             | Description                                    |
| ------------ | -------------------------------------------------------------- | ---------------------------------------------------- | ----------------------------------------------- |
| `input`      | `Bun.BunFile`                                                   | —                                                     | Path to the `routes.json` produced by Spring Boot |
| `output`     | `Bun.BunFile`                                                   | —                                                     | Directory to write generated files into           |
| `enabled`    | `("schema.gen.ts" \| "fetch.gen.ts" \| "tanstack.gen.ts")[]`    | `["schema.gen.ts", "fetch.gen.ts", "tanstack.gen.ts"]` | Which generators to run                           |
| `writeIndex` | `boolean`                                                       | `true`                                                | Whether to emit an `index.ts` barrel file         |

To generate `routes.json`, use the Spring Boot side of the library set.

## License

Licensed under [MIT License](LICENSE).
