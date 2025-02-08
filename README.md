# frtrss

A lightweight, type-safe authorization library for JavaScript/TypeScript applications that provides a flexible permission management system with field-level granularity.

## Features

- Type-safe, intuitive API for defining permissions
- Field-level permissions with nested path support
- High performance for hundreds of permission checks per second
- Serialization/deserialization capabilities
- Default "deny all" security posture

## Installation

```bash
npm install frtrss
```

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
