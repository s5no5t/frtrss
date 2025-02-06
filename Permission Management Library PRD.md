# Permission Management Library PRD

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
  operator: "eq" | "contains" | "gt" | "gte" | "lt" | "lte";
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
const permissions = new PermissionBuilder()
  .allow(subject)
  .to(action)
  .on(object)
  .fields(fields)
  .when(conditions)
  .deny(subject)
  .to(action)
  .on(object)
  .fields(fields)
  .when(conditions)
  .build();
```

### 3.2 Permission Checking

```typescript
// Check specific field
permissions.check({
  subject: subject,
  action: action,
  object: object,
  field: field,
  data: data
}): boolean

// Check entire object
permissions.checkObject(
  subject: Subject,
  action: Action,
  object: Object,
  data: T
): boolean
```

### 3.3 Serialization

```typescript
// To JSON
const json = permissions.toJSON();

// From JSON
const permissions = Permissions.fromJSON(json);
```

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
- Array operations: `contains`
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

```typescript
const permissions = new PermissionBuilder()
  .allow("User")
  .to("read")
  .on("Document")
  .fields(["metadata.title", "content"])
  .when({ field: "status", operator: "eq", value: "published" })
  .build();

const canAccess = permissions.checkObject("User", "read", "Document", {
  metadata: { title: "Hello" },
  content: "World",
  status: "published",
});
```
