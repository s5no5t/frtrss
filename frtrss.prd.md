# frtrss PRD

## 1. Overview

A lightweight, type-safe authorization library for JavaScript/TypeScript applications that provides a flexible permission management system with field-level granularity.

### 1.1 Goals

- Provide a type-safe, intuitive API for defining permissions
- Support field-level permissions with nested path support
- Maintain high performance for hundreds of permission checks per second
- Offer serialization/deserialization capabilities
- Default to "deny all" security posture
- Support both Node.js and browser environments seamlessly

### 1.2 Non-Goals

- Async permission checks
- Middleware integration
- Built-in caching
- Framework-specific integrations
- Audit logging
- CASL compatibility

### 1.3 Environment Support

The library is designed to work seamlessly in both Node.js and browser environments:

- **Node.js Support**
  - CommonJS (require) via `.js` files
  - ES Modules (import) via `.mjs` files
  - TypeScript definitions via `.d.ts` files

- **Browser Support**
  - ES Modules for modern browsers
  - Compatible with all major bundlers (webpack, rollup, vite, etc.)
  - No browser-specific APIs or dependencies
  - Tree-shakeable for optimal bundle size

The package provides appropriate entry points for each environment through the `exports` field in package.json, ensuring the correct version is used based on the consumer's environment.

## 2. Core Concepts

### 2.1 Permission Components

```typescript
type Subject = any; // User-definable type
type ResourceDefinition<TData, TActions extends string> = {
  data: TData;
  actions: TActions;
};
type Field = string; // Dot-notation field path
type Condition = {
  field: string;
  operator: "eq" | "ne" | "in" | "nin" | "gt" | "gte" | "lt" | "lte" | "size";
  value: any;
};
```

### 2.2 Rule Evaluation

- All permissions are denied by default
- Allow rules grant specific permissions
- Deny rules override allow rules
- Field-level permissions require explicit field specification
- All conditions must be satisfied (AND logic)
- Actions must be defined in the resource's action type

### 2.3 Public Access

The library supports defining public access rules that apply to all subjects using the `allowAll` method. This is useful for:
- Public resources that should be accessible to anyone
- Default permissions that apply regardless of subject type
- Base-level access rules that can be overridden by more specific deny rules

Public access rules follow the same evaluation logic as regular rules:
- They still respect field restrictions
- They still respect action restrictions
- They still respect conditions
- They can be overridden by deny rules

### 2.4 Operators

The library supports the following operators:

#### Value Comparison Operators
- `eq`: Equal to
- `ne`: Not equal to
- `gt`: Greater than
- `gte`: Greater than or equal to
- `lt`: Less than
- `lte`: Less than or equal to

#### Array Operators
- `in`: Check if a value exists in an array
- `nin`: Check if a value does not exist in an array
- `size`: Compare the length of an array with a number

## 3. API Specification

### 3.1 Builder API

```typescript
// Core types for the permission system
type Primitive = string | number | boolean | null;
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// Resource definition with type-safe actions
type ResourceDefinition<TData, TActions extends string = string> = {
  data: TData;
  actions: TActions;
};

// Helper types for resource definitions
type ResourceType<T, K extends keyof T> = T[K] extends ResourceDefinition<infer D, any> ? D : never;
type ResourceActions<T, K extends keyof T> = T[K] extends ResourceDefinition<any, infer A> ? A : never;

// Operator types based on value types
type ComparisonOperator = "eq" | "ne" | "gt" | "gte" | "lt" | "lte";
type ArrayOperator = "in" | "nin" | "size";
type Operator = ComparisonOperator | ArrayOperator;

// Type-safe condition based on field type
export type ArraySizeCondition<T, P extends PathsToStringProps<T>> = {
  field: P;
  operator: "size";
  value: number;
};

export type ArrayValueCondition<T, P extends PathsToStringProps<T>> = {
  field: P;
  operator: "in" | "nin";
  value: ValueAtPath<T, P> extends Array<infer E> ? E : never;
};

export type ValueCondition<T, P extends PathsToStringProps<T>> = {
  field: P;
  operator: ComparisonOperator;
  value: ValueAtPath<T, P>;
};

export type Condition<T, P extends PathsToStringProps<T>> = ValueAtPath<T, P> extends Array<any>
  ? ArraySizeCondition<T, P> | ArrayValueCondition<T, P>
  : ValueCondition<T, P>;

// Type-safe builder for resource definitions
class PermissionBuilder<T extends Record<string, ResourceDefinition<any, any>>> {
  allow<S>(subject: S): ActionBuilder<T, S>;
  allowAll(): ActionBuilder<T, "*">;
  deny<S>(subject: S): ActionBuilder<T, S>;
  build(): Permissions<T>;
}

class ActionBuilder<T extends Record<string, ResourceDefinition<any, any>>, S> {
  // Type-safe actions based on resource definition
  to<O extends keyof T>(
    actions: ResourceActions<T, O> | ResourceActions<T, O>[]
  ): ObjectBuilder<T, S>;
}

class ObjectBuilder<T extends Record<string, ResourceDefinition<any, any>>, S> {
  on<O extends keyof T>(object: O): FieldBuilder<T, S, O>;
}

class FieldBuilder<T extends Record<string, ResourceDefinition<any, any>>, S, O extends keyof T> {
  fields(fields: Array<PathsToStringProps<ResourceType<T, O>>>): ConditionBuilder<T, S, O>;
  allFields(): ConditionBuilder<T, S, O>;
}

class ConditionBuilder<T extends Record<string, ResourceDefinition<any, any>>, S, O extends keyof T> {
  when<P extends PathsToStringProps<ResourceType<T, O>>>(
    condition: Condition<ResourceType<T, O>, P>
  ): ConditionBuilder<T, S, O>;
  build(): Permissions<T>;
}
```

### 3.2 Permission Checking

```typescript
// Type-safe permissions class
class Permissions<T extends Record<string, ResourceDefinition<any, any>>> {
  check(params: {
    subject: any;
    action: string;
    object: keyof T;
    field: string;
    data: DeepPartial<ResourceType<T, keyof T>>;
  }): boolean;

  checkObject<O extends keyof T>(
    subject: any,
    action: string,
    object: O,
    data: ResourceType<T, O>
  ): boolean;
}
```

### 3.3 Serialization

The library provides format-agnostic serialization support through a DTO (Data Transfer Object) interface:

```typescript
// Core DTO types
interface PermissionRuleDTO {
  effect: 'allow' | 'deny';
  subject: unknown;
  action: string;
  object: string;
  fields: string[];
  conditions?: Array<{
    field: string;
    operator: Operator;
    value: unknown;
  }>;
}

interface PermissionsDTO {
  version: 1;
  rules: PermissionRuleDTO[];
}

// Zod schema for validation
const permissionsDTOSchema = z.object({
  version: z.literal(1),
  rules: z.array(
    z.object({
      effect: z.enum(["allow", "deny"]),
      subject: z.unknown(),
      action: z.string(),
      object: z.string(),
      fields: z.array(z.string()),
      conditions: z
        .array(
          z.object({
            field: z.string(),
            operator: z.enum([
              "eq",
              "ne",
              "in",
              "nin",
              "gt",
              "gte",
              "lt",
              "lte",
              "size",
            ]),
            value: z.unknown(),
          })
        )
        .optional(),
    })
  ),
});

// Type-safe permissions class
class Permissions<TMap extends ResourceTypeMap<T>> {
  // Convert permissions to DTO
  toDTO(): PermissionsDTO;

  // Create permissions from DTO
  static fromDTO<TMap extends ResourceTypeMap<T>>(dto: unknown): Permissions<TMap>;
}
```

The serialization system:
- Uses a version field to support future schema changes
- Is transport format agnostic (can be used with JSON, YAML, etc.)
- Validates DTOs using Zod schemas
- Throws `PermissionValidationError` for invalid DTOs
- Preserves type safety when deserializing

## 4. Features

### 4.1 Field Paths

- Supports dot notation for nested fields
- Supports wildcards for array elements
- Examples:
  - `metadata.title`
  - `comments.*.text`
  - `author.address.city`

### 4.2 Conditions

- Value comparison:
  - `eq`: Equal to
  - `ne`: Not equal to
  - `gt`: Greater than
  - `gte`: Greater than or equal to
  - `lt`: Less than
  - `lte`: Less than or equal to
- Array operations:
  - `in`: Check if a value exists in an array
  - `nin`: Check if a value does not exist in an array
  - `size`: Compare array length with a number
- Multiple conditions use AND logic

### 4.3 Type Safety

- Full TypeScript support
- Type-safe field paths
- Operator validation based on field types
- Generic type constraints for objects

## 5. Performance

### 5.1 Requirements

- Support hundreds of rules
- Support hundreds of checks per second
- Optimized rule checking

### 5.2 Implementation Considerations

- Efficient rule indexing
- Optimized field path resolution
- Fast condition evaluation

## 6. Example Usage

### 6.1 Example with one resource type

```typescript
// Example domain types
interface User {
  id: string;
  role: "admin" | "editor" | "user";
}

interface Document {
  id: string;
  metadata: {
    title: string;
    status: "draft" | "published" | "archived";
    tags: string[];
    version: number;
  };
  content: string;
  author: {
    id: string;
    name: string;
    email: string;
  };
  reviewers: string[];
  lastModified: Date;
}

// Define allowed actions
type DocumentActions = "read" | "write" | "update" | "delete" | "archive";

// Define resource type mapping
type Resources = {
  document: ResourceDefinition<Document, DocumentActions>;
};

const permissions = new PermissionBuilder<Resources>()
  // Multiple actions in a single rule
  .allow<User>({ id: "1", role: "editor" })
  .to(["read", "update"])
  .on("document")
  .fields(["metadata.title", "content", "author.name"])
  .when({
    field: "metadata.status",
    operator: "eq",
    value: "published",
  })
  // Single action
  .allow<User>({ id: "1", role: "editor" })
  .to("write")
  .on("document")
  .fields(["metadata.title"])
  .when({
    field: "metadata.status",
    operator: "ne",
    value: "archived",
  })
  // Multiple actions with deny rule
  .deny<User>({ id: "1", role: "editor" })
  .to(["delete", "archive"])
  .on("document")
  .fields(["*"])
  .and()
  .build();

// Usage with type checking
const doc: Document = {
  id: "123",
  metadata: {
    title: "Test Document",
    status: "published",
    tags: ["important"],
    version: 2,
  },
  content: "Hello World",
  author: {
    id: "author1",
    name: "John Doe",
    email: "john@example.com",
  },
  reviewers: ["user1", "user2"],
  lastModified: new Date(),
};

const user: User = {
  id: "1",
  role: "editor",
};

// Type-safe permission checks
const canRead = permissions.checkObject(user, "read", "document", doc); // true
const canUpdate = permissions.checkObject(user, "update", "document", doc); // true
const canDelete = permissions.checkObject(user, "delete", "document", doc); // false
```

### 6.2 Example with multiple resource types

```typescript
// Resource types
interface Document {
  id: string;
  metadata: {
    title: string;
    status: "draft" | "published";
    tags: string[];
  };
  content: string;
}

interface Project {
  id: string;
  name: string;
  members: Array<{
    userId: string;
    role: "owner" | "member";
  }>;
  settings: {
    isPrivate: boolean;
    allowComments: boolean;
  };
}

// Define allowed actions for each resource
type DocumentActions = "read" | "write" | "delete";
type ProjectActions = "read" | "write" | "manage" | "configure";

// Define resource type mapping
type Resources = {
  document: ResourceDefinition<Document, DocumentActions>;
  project: ResourceDefinition<Project, ProjectActions>;
};

// Subject type
interface User {
  id: string;
  role: "admin" | "user";
}

// Usage example
const permissions = new PermissionBuilder<Resources>()
  // Document permissions
  .allow<User>({ id: "1", role: "user" })
  .to("read")
  .on("document")
  .fields(["metadata.title", "content"])
  .when({
    field: "metadata.status",
    operator: "eq",
    value: "published",
  })

  // Project permissions
  .allow<User>({ id: "1", role: "user" })
  .to("read")
  .on("project")
  .fields(["name", "members.*.userId", "settings.allowComments"])
  .when({
    field: "members",
    operator: "in",
    value: { userId: "1", role: "member" },
  })

  // Admin permissions for both types
  .allow<User>({ id: "2", role: "admin" })
  .to("manage")
  .on("project")
  .allFields()
  .build();

// Usage
const doc: Document = {
  id: "1",
  metadata: {
    title: "Test Document",
    status: "published",
    tags: ["important"],
  },
  content: "Hello World",
};

const project: Project = {
  id: "2",
  name: "Test Project",
  members: [
    { userId: "1", role: "member" },
    { userId: "2", role: "owner" },
  ],
  settings: {
    isPrivate: false,
    allowComments: true,
  },
};

const user: User = { id: "1", role: "user" };
const admin: User = { id: "2", role: "admin" };

// Type-safe permission checks
const canReadDoc = permissions.checkObject(user, "read", "document", doc);
const canReadProject = permissions.checkObject(user, "read", "project", project);
const canManageProject = permissions.checkObject(admin, "manage", "project", project);

// TypeScript will catch invalid actions
const invalidCheck = permissions.check({
  subject: user,
  action: "invalid", // Type error: invalid action
  object: "document",
  field: "content",
  data: doc,
});
```

### 6.3 Example with nested fields

```typescript
// Resource type with nested arrays and objects
interface BlogPost {
  id: string;
  title: string;
  content: string;
  author: {
    id: string;
    name: string;
    email: string;
    preferences: {
      notifications: boolean;
      theme: string;
    };
  };
  comments: Array<{
    id: string;
    text: string;
    author: {
      id: string;
      name: string;
    };
    replies: Array<{
      id: string;
      text: string;
      author: {
        id: string;
        name: string;
      };
    }>;
  }>;
  tags: string[];
  metadata: {
    created: Date;
    modified: Date;
    views: number;
  };
}

interface User {
  id: string;
  role: "admin" | "editor" | "user";
}

// Permission builder usage with wildcards
const permissions = new PermissionBuilder<BlogPost>()
  // Regular user permissions
  .allow<User>({ id: "1", role: "user" })
  .to("read")
  .on("BlogPost")
  .fields([
    "title", // Simple field
    "content", // Simple field
    "author.name", // Nested field
    "comments.*.text", // Array item field
    "comments.*.author.name", // Nested field in array item
    "comments.*.replies.*", // All fields in nested array
    "tags.*", // Array elements
  ])
  .when({
    field: "metadata.views",
    operator: "gte",
    value: 0,
  })

  // Comment author permissions
  .allow<User>({ id: "1", role: "user" })
  .to("update")
  .on("BlogPost")
  .fields([
    "comments.*.text", // Can edit own comment text
    "comments.*.replies.*.text", // Can edit own replies
  ])
  .when({
    field: "comments.*.author.id",
    operator: "eq",
    value: "1",
  })

  // Editor permissions
  .allow<User>({ id: "2", role: "editor" })
  .to("update")
  .on("BlogPost")
  .fields([
    "title",
    "content",
    "tags.*", // Can edit any tag
    "comments.*", // Can edit all comment fields
  ])

  // Admin permissions
  .allow<User>({ id: "3", role: "admin" })
  .to("manage")
  .on("BlogPost")
  .fields(["*"]) // Can access all fields
  .build();

// Example usage
const blogPost: BlogPost = {
  id: "1",
  title: "Hello World",
  content: "Welcome to my blog",
  author: {
    id: "1",
    name: "John Doe",
    email: "john@example.com",
    preferences: {
      notifications: true,
      theme: "dark",
    },
  },
  comments: [
    {
      id: "c1",
      text: "Great post!",
      author: {
        id: "1",
        name: "John Doe",
      },
      replies: [
        {
          id: "r1",
          text: "Thanks!",
          author: {
            id: "2",
            name: "Jane Smith",
          },
        },
      ],
    },
  ],
  tags: ["typescript", "programming"],
  metadata: {
    created: new Date(),
    modified: new Date(),
    views: 100,
  },
};

const user: User = { id: "1", role: "user" };

// Permission checks
const canReadComment = permissions.check({
  subject: user,
  action: "read",
  object: "BlogPost",
  field: "comments.0.text",
  data: blogPost,
}); // true

const canUpdateOwnComment = permissions.check({
  subject: user,
  action: "update",
  object: "BlogPost",
  field: "comments.0.text",
  data: blogPost,
}); // true (because comment.author.id === user.id)

const canReadEmail = permissions.check({
  subject: user,
  action: "read",
  object: "BlogPost",
  field: "author.email",
  data: blogPost,
}); // false (email not in allowed fields)
```

### 6.4 Example with Public Access

This example demonstrates how to use `allowAll` to define public access rules that apply to any subject type.

**Example Code:**
```typescript
import { PermissionBuilder } from "frtrss";

interface Document {
  id: string;
  metadata: {
    title: string;
    status: "draft" | "published" | "archived";
  };
  content: string;
}

// Create permissions with public access rules
const permissions = new PermissionBuilder<Document>()
  // Allow public read access to titles of published documents
  .allowAll()
  .to("read")
  .on("Document")
  .fields(["metadata.title"])
  .when({
    field: "metadata.status",
    operator: "eq",
    value: "published",
  })
  // Allow public read access to document content
  .allowAll()
  .to("read")
  .on("Document")
  .fields(["content"])
  .when({
    field: "metadata.status",
    operator: "eq",
    value: "published",
  })
  // Deny access to archived documents for everyone
  .deny({ role: "*" })
  .to(["read", "write"])
  .on("Document")
  .allFields()
  .when({
    field: "metadata.status",
    operator: "eq",
    value: "archived",
  })
  .build();

// Test with different subject types
const regularUser = { id: "1", role: "user" };
const anonymousUser = { type: "anonymous" };
const serviceAccount = { serviceId: "123", type: "service" };

// Check permissions for published document
const publishedDoc = {
  id: "1",
  metadata: {
    title: "Public Document",
    status: "published",
  },
  content: "Hello World",
} as Document;

console.log(
  "Regular user can read title:",
  permissions.check({
    subject: regularUser,
    action: "read",
    object: "Document",
    field: "metadata.title",
    data: publishedDoc,
  })
); // true

console.log(
  "Anonymous user can read title:",
  permissions.check({
    subject: anonymousUser,
    action: "read",
    object: "Document",
    field: "metadata.title",
    data: publishedDoc,
  })
); // true

console.log(
  "Service account can read title:",
  permissions.check({
    subject: serviceAccount,
    action: "read",
    object: "Document",
    field: "metadata.title",
    data: publishedDoc,
  })
); // true

// Check permissions for archived document
const archivedDoc = {
  id: "2",
  metadata: {
    title: "Archived Document",
    status: "archived",
  },
  content: "Old Content",
} as Document;

console.log(
  "Regular user can read archived:",
  permissions.check({
    subject: regularUser,
    action: "read",
    object: "Document",
    field: "metadata.title",
    data: archivedDoc,
  })
); // false

console.log(
  "Anonymous user can read archived:",
  permissions.check({
    subject: anonymousUser,
    action: "read",
    object: "Document",
    field: "metadata.title",
    data: archivedDoc,
  })
); // false
```

**Explanation:**  
This example shows how to:
- Define public access rules using `allowAll`
- Apply conditions to public access rules
- Override public access with deny rules
- Handle different subject types with the same public rules
- Combine public access with specific deny rules

### 5. Storing and Loading Permissions

```typescript
console.log(`Application user can write: ${canUserWrite}`);
console.log(`Service account can read: ${canServiceRead}`);
```

### 3.4 Example Usage with Record Type

```typescript
// Using record type mapping
interface ResourceTypes {
  document: Document;
  project: Project;
}

const permissions = new PermissionBuilder<ResourceTypes>()
  .allow({ role: "editor" })
  .to(["read", "write"])
  .on("document")
  .fields(["title", "content"])
  .when({
    field: "status",
    operator: "eq",
    value: "draft"
  })
  .build();

// Type-safe permission checks
const doc = {
  id: "1",
  title: "Hello",
  content: "World",
  status: "draft"
};

// Works with record type approach
const canEdit = permissions.check({
  subject: { role: "editor" },
  action: "write",
  object: "document",
  field: "content",
  data: doc
});
```

### 3.5 Example Usage with Public Access
// ... existing code ...
