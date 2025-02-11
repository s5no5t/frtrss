# frtrss

![frtrss logo](logo.png)

A type-safe attribute-based access control (ABAC) authorization library for TypeScript applications.

## Features

- Type-safe, intuitive API for defining permissions
- Field-level permissions with nested path support
- Allow and deny permissions
- Serialization/deserialization support
- Optional validation support with [zod](https://github.com/colinhacks/zod)
- Safe default "deny all"
- Full browser and Node.js compatibility with CommonJS and ES Modules support
- Tree-shakeable for optimal bundle size
- Complete TypeScript definitions

## Installation

```bash
npm install frtrss
```

Zod is an optional peer dependency. If you want to use schema validation (recommended), install zod:

```bash
npm install zod
```

If you don't install zod, frtrss will fall back to basic runtime validation.

## Basic Usage

```typescript
import { PermissionBuilder, ResourceDefinition } from "frtrss";

interface User {
  id: string;
  role: "admin" | "editor" | "user";
}

interface Document {
  id: string;
  metadata: {
    title: string;
    status: "draft" | "published" | "archived";
    version: number;
  };
  content: string;
}

type DocumentActions = "read" | "write";

// Define the object type mapping
type Objects = {
  document: ResourceDefinition<Document, DocumentActions>;
};

// Create permissions with allow and deny rules
const permissions = new PermissionBuilder<Objects>()
  // Allow editors to read published documents with version >= 2
  .allow<User>({ id: "1", role: "editor" })
  .to(["read", "write"])
  .on("document") // document name is statically typed
  .fields(["metadata.title", "content"])    
  .when({
    field: "metadata.status", // field name is statically typed
    operator: "eq",
    value: "published",
  })
  .when({
    field: "metadata.version",
    operator: "gte",
    value: 2,
  })
  // But deny write access to published documents
  .deny<User>({ id: "1", role: "editor" })
  .to("write")
  .on("document")
  .fields(["content"])
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
  object: "document",
  field: "content",
  data: {
    metadata: { 
      status: "published",
      version: 3
    },
  },
}); // true

const canWrite = permissions.check({
  subject: { id: "1", role: "editor" },
  action: "write",
  object: "document",
  field: "content",
  data: {
    metadata: { 
      status: "published",
      version: 3
    },
  },
}); // false - denied by explicit deny rule
```

## API Documentation & Use Cases

See [API.md](./doc/API.md).

## Attribute-Based Access Control (ABAC)

frtrss implements [Attribute-Based Access Control (ABAC)](https://en.wikipedia.org/wiki/Attribute-based_access_control), a flexible and powerful authorization model that evaluates permissions based on attributes/properties of:

- The subject (user/service requesting access)
- The action (operation being performed)
- The object (resource being accessed)
- The fields (specific properties of the object being accessed)
- The conditions (context of the request)

This approach allows for more dynamic and fine-grained access control compared to traditional role-based systems, enabling complex permission rules based on data properties and conditions.

## frtrss vs [casl.js](https://github.com/stalniy/casl)

* simpler and more intuitive API
* more type safety and developer experience
* doesn't rely on class reflection for object types
* more explicit about field-level permissions
* zod schema validation

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
