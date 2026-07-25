# @spring-mox/base

The second phase library for [Spring Mox](https://github.com/0xaa55h/spring-mox) library set.
Get started by installing the library. The library requires [Bun](https://bun.sh/) runtime.

## Usage

The library exports set of generator classes and `generate` function itself. The use is as simple as:

```typescript
await generate(Bun.file("<path to routes.json>"), Bun.file("<path to dir where to export generated files>"));
```

To generate `routes.json`, use the Spring Boot library. Consult the file in the source code for other options.

## License

Licensed under [MIT License](LICENSE).