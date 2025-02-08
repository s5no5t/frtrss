# frtrss

A lightweight, type-safe authorization library for JavaScript/TypeScript applications that provides a flexible permission management system with field-level granularity.

## Features

- Type-safe, intuitive API for defining permissions
- Field-level permissions with nested path support
- High performance for hundreds of permission checks per second
- Serialization/deserialization capabilities
- Default "deny all" security posture
- Works seamlessly in both Node.js and browser environments
- Tree-shakeable for optimal bundle size

## Installation

```bash
npm install frtrss
```

## Environment Support

frtrss is designed to work in both Node.js and browser environments out of the box:

- **Node.js**: Supports both CommonJS (`require`) and ES Modules (`import`)
- **Browsers**: Ships as ES Modules, compatible with all major bundlers
- **TypeScript**: Full type definitions included

No additional configuration is needed - the package automatically uses the right format for your environment.

## Basic Usage

```typescript
import { PermissionBuilder } from "frtrss";

interface User {
  id: string;
  role: "admin" | "editor" | "user";
}

interface Document {
  id: string;
  metadata: {
    title: string;
    status: "draft" | "published" | "archived";
  };
  content: string;
}

const permissions = new PermissionBuilder<Document>()
  .allow<User>({ id: "1", role: "editor" })
  .to("read")
  .on("Document")
  .fields(["metadata.title", "content"])
  .when({
    field: "metadata.status",
    operator: "eq",
    value: "published",
  })
  .build();

// Check permissions
const canRead = permissions.check({
  subject: { id: "1", role: "editor" },
  action: "read",
  object: "Document",
  field: "content",
  data: {
    metadata: { status: "published" },
  },
}); // true
```

## Attribute-Based Access Control (ABAC)

frtrss implements [Attribute-Based Access Control (ABAC)](https://en.wikipedia.org/wiki/Attribute-based_access_control), a flexible and powerful authorization model that evaluates permissions based on attributes/properties of:

- The subject (user/service requesting access)
- The object (resource being accessed)
- The action (operation being performed)
- The environment (context of the request)

This approach allows for more dynamic and fine-grained access control compared to traditional role-based systems, enabling complex permission rules based on data properties and conditions.

## Documentation

For detailed documentation and examples, please see the [documentation](./docs).

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build the package
npm run build

# Run linter
npm run lint

# Type check
npm run typecheck
```

## License

MIT
