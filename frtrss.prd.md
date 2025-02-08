# frtrss PRD

## 1. Overview

A lightweight, type-safe authorization library for JavaScript/TypeScript applications that provides a flexible permission management system with field-level granularity.

### 1.1 Goals

- Provide a type-safe, intuitive API for defining permissions
- Support field-level permissions with nested path support
- Maintain high performance for hundreds of permission checks per second
- Offer serialization/deserialization capabilities
- Default to "deny all" security posture

### 1.2 Non-Goals

- Async permission checks
- Middleware integration
- Built-in caching
- Framework-specific integrations
- Audit logging
- CASL compatibility

## 2. Core Concepts

### 2.1 Permission Components

```typescript
type Subject = any; // User-definable type
type Action = string; // Custom action string
type Object = string; // Resource type identifier
type Field = string; // Dot-notation field path
type Condition = {
  field: string;
  operator: "eq" | "in" | "gt" | "gte" | "lt" | "lte";
  value: any;
};
```

### 2.2 Rule Evaluation

- All permissions are denied by default
- Allow rules grant specific permissions
- Deny rules override allow rules
- Field-level permissions require explicit field specification
- All conditions must be satisfied (AND logic)

## 3. API Specification

### 3.1 Builder API

```typescript
// Core types for the permission system
type Primitive = string | number | boolean | null;
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// Operator types based on value types
type ComparisonOperator = "eq" | "gt" | "gte" | "lt" | "lte";
type ArrayOperator = "in";
type Operator = ComparisonOperator | ArrayOperator;

// Type-safe condition based on field type
type Condition<T, K extends keyof T> = {
  field: K;
  operator: T[K] extends Array<any> ? ArrayOperator : ComparisonOperator;
  value: T[K];
};

// Type-safe builder
class PermissionBuilder<T> {
  allow<S>(subject: S): ActionBuilder<T, S>;
  deny<S>(subject: S): ActionBuilder<T, S>;
  build(): Permissions<T>;
}

class ActionBuilder<T, S> {
  to(action: string): ObjectBuilder<T, S>;
}

class ObjectBuilder<T, S> {
  on<O extends string>(object: O): FieldBuilder<T, S, O>;
}

class FieldBuilder<T, S, O> {
  // Type-safe field paths using dot notation
  fields<K extends keyof T>(
    fields: Array<
      K | `${string & K}.${string}` | `${string & K}.*.${string}` | "*"
    >
  ): ConditionBuilder<T, S, O>;
  allFields(): ConditionBuilder<T, S, O>;
}

class ConditionBuilder<T, S, O> {
  when<K extends keyof T>(
    condition: Condition<T, K>
  ): PermissionBuilder<T>;
  and(): PermissionBuilder<T>;
}
```

### 3.2 Permission Checking

```typescript
// Type-safe permissions class
class Permissions<T> {
  check(params: {
    subject: any;
    action: string;
    object: string;
    field: string;
    data: DeepPartial<T>;
  }): boolean;

  checkObject<S>(subject: S, action: string, object: string, data: T): boolean;
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
  rules: z.array(z.object({
    effect: z.enum(['allow', 'deny']),
    subject: z.unknown(),
    action: z.string(),
    object: z.string(),
    fields: z.array(z.string()),
    conditions: z.array(z.object({
      field: z.string(),
      operator: z.enum(['eq', 'in', 'gt', 'gte', 'lt', 'lte']),
      value: z.unknown()
    })).optional()
  }))
});

// Type-safe permissions class
class Permissions<T> {
  // Convert permissions to DTO
  toDTO(): PermissionsDTO;

  // Create permissions from DTO
  static fromDTO<T>(dto: unknown): Permissions<T>;
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

- Equality: `eq`
- Comparison: `gt`, `gte`, `lt`, `lte`
- Array operations: `in`
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

## 6.1 Example with one resource type

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

const permissions = new PermissionBuilder<Document>()
  .allow<User>({ id: "1", role: "editor" })
  .to("read")
  .on("Document")
  .fields(["metadata.title", "content", "author.name"])
  .when({
    field: "metadata.status",
    operator: "eq", // TypeScript ensures this is valid for string type
    value: "published", // TypeScript ensures this is 'draft' | 'published' | 'archived'
  })
  .allow<User>({ id: "1", role: "admin" })
  .to("update")
  .on("Document")
  .fields(["metadata.tags"])
  .when({
    field: "metadata.tags",
    operator: "in", // TypeScript ensures this is valid for array type
    value: ["important"],
  })
  .allow<User>({ id: "1", role: "editor" })
  .to("update")
  .on("Document")
  .fields(["metadata.version"])
  .when({
    field: "metadata.version",
    operator: "gte", // TypeScript ensures this is valid for number type
    value: 1,
  })
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
const canRead = permissions.checkObject(user, "read", "Document", doc);
const canUpdate = permissions.check({
  subject: user,
  action: "update",
  object: "Document",
  field: "metadata.version",
  data: { metadata: { version: 2 } },
});
```

## 6.2 Example with multiple resource types

```typescript
// Resource types
interface Document {
  id: string;
  type: "document";
  metadata: {
    title: string;
    status: "draft" | "published";
    tags: string[];
  };
  content: string;
}

interface Project {
  id: string;
  type: "project";
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

// Union type for all resources
type Resource = Document | Project;

// Subject type
interface User {
  id: string;
  role: "admin" | "user";
}

// Type helper to extract fields based on resource type
type ResourceFields<T extends Resource> = T extends Document
  ? FieldPath<Document>
  : T extends Project
  ? FieldPath<Project>
  : never;

// Usage example
const permissions = new PermissionBuilder<Resource>()
  // Document permissions
  .allow<User>({ id: "1", role: "user" })
  .to("read")
  .on("document")
  .fields<Document>(["metadata.title", "content"])
  .when({
    field: "metadata.status",
    operator: "eq",
    value: "published",
  })

  // Project permissions
  .allow<User>({ id: "1", role: "user" })
  .to("read")
  .on("project")
  .fields<Project>(["name", "members.*.userId", "settings.allowComments"])
  .when({
    field: "members",
    operator: "in",
    value: { userId: "1", role: "member" },
  })

  // Admin permissions for both types
  .allow<User>({ id: "2", role: "admin" })
  .to("manage")
  .on("document")
  .allFields()
  .allow<User>({ id: "2", role: "admin" })
  .to("manage")
  .on("project")
  .allFields()
  .build();

// Usage
const doc: Document = {
  id: "1",
  type: "document",
  metadata: {
    title: "Test Document",
    status: "published",
    tags: ["important"],
  },
  content: "Hello World",
};

const project: Project = {
  id: "2",
  type: "project",
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
const canReadProject = permissions.checkObject(
  user,
  "read",
  "project",
  project
);
const canManageDoc = permissions.checkObject(admin, "manage", "document", doc);

// TypeScript will catch invalid field paths or wrong resource types
const invalidCheck = permissions.check({
  subject: user,
  action: "read",
  object: "document",
  field: "invalid.path", // Type error: invalid field path
  data: doc,
});
```

## 6.3 Example with nested fields

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
