# frtrss API Documentation

## Table of Contents
1. [Public API Methods](#public-api-methods)
2. [Main Use Cases](#main-use-cases)
   - [Basic Permission Check](#1-basic-permission-check)
   - [Field-level Permission](#2-field-level-permission)
   - [Attribute-Based Access Control (ABAC)](#3-attribute-based-access-control-abac)
3. [Conclusion](#conclusion)

## Public API Methods

### `PermissionBuilder<T>`
The `PermissionBuilder` class is the main entry point for creating your permission policies. It is a generic builder that lets you configure permissions based on a resource type `T`.

**Public Methods:**

- **`allow<S>(subject: S): PermissionBuilder<T>`**  
  Registers a subject (for example, a user or service) that is allowed permission.  
  _Usage:_  
  ```typescript
  .allow({ id: "1", role: "editor" })
  ```

- **`to(action: string): PermissionBuilder<T>`**  
  Specifies the action that the permission applies to (e.g., "read", "write").  
  _Usage:_  
  ```typescript
  .to("read")
  ```

- **`on(object: string): PermissionBuilder<T>`**  
  Defines the resource (object) the permission is related to, like "Document".  
  _Usage:_  
  ```typescript
  .on("Document")
  ```

- **`fields(fieldList: string[]): PermissionBuilder<T>`**  
  Restricts the permission to specific fields of the target resource. Field paths are provided as an array of strings.  
  _Usage:_  
  ```typescript
  .fields(["metadata.title", "content"])
  ```

- **`when(condition: { field: string, operator: string, value: any }): PermissionBuilder<T>`**  
  Adds an attribute-based condition to refine the permission. The condition is applied against the resource's data properties.  
  _Usage:_  
  ```typescript
  .when({
    field: "metadata.status",
    operator: "eq",
    value: "published",
  })
  ```

- **`build(): PermissionPolicy`**  
  Finalizes and constructs the permission policy based on the configured rules.  
  _Usage:_  
  ```typescript
  .build();
  ```

- **`check(options: { subject: any, action: string, object: string, field: string, data: any }): boolean`**  
  Evaluates whether a given subject is permitted to perform the specified action on the object/field, based on the built policy.  
  _Usage:_  
  ```typescript
  const canRead = permissions.check({
    subject: { id: "1", role: "editor" },
    action: "read",
    object: "Document",
    field: "content",
    data: { metadata: { status: "published" } },
  });
  ```

*Note: The precise signatures and types are defined in the package's TypeScript definitions.*

## Main Use Cases

### 1. Basic Permission Check
In a common scenario, you may simply want to verify whether a particular subject (user) is allowed to perform a specific action on a resource.

**Example Code:**
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
  .build();

const canRead = permissions.check({
  subject: { id: "1", role: "editor" },
  action: "read",
  object: "Document",
  field: "", // No field-specific restriction
  data: {}   // Object data not needed for this basic check
});

console.log(`User can read Document: ${canRead}`);
```

**Explanation:**  
This example sets up a basic permission allowing a user with `{ id: "1", role: "editor" }` to perform the "read" action on the "Document" resource. The `check` method returns a boolean indicating whether the operation is permitted.

---

### 2. Field-level Permission
Often you may wish to restrict access to only certain parts or fields of a resource rather than the entire object.

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

const permissions = new PermissionBuilder<Document>()
  .allow({ id: "2", role: "editor" })
  .to("read")
  .on("Document")
  .fields(["metadata.title", "content"])
  .build();

const canReadTitle = permissions.check({
  subject: { id: "2", role: "editor" },
  action: "read",
  object: "Document",
  field: "metadata.title",
  data: {
    metadata: { status: "published" },
  },
});

console.log(`User can read title: ${canReadTitle}`);
```

**Explanation:**  
Here, the permission is narrowed down to only specific fields within the `Document`, namely "metadata.title" and "content". Even if the user is permitted for the "read" action, the access will only be valid for these declared fields.

---

### 3. Attribute-Based Access Control (ABAC)
For more dynamic cases, you can enforce conditions that depend on the attributes of the target resource, ensuring that permissions only apply when certain conditions are met.

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

const permissions = new PermissionBuilder<Document>()
  .allow({ id: "3", role: "editor" })
  .to("read")
  .on("Document")
  .fields(["metadata.title", "content"])
  .when({
    field: "metadata.status",
    operator: "eq",
    value: "published",
  })
  .build();

const canReadContent = permissions.check({
  subject: { id: "3", role: "editor" },
  action: "read",
  object: "Document",
  field: "content",
  data: {
    metadata: { status: "published" },
  },
});

console.log(`User can read content: ${canReadContent}`);
```

**Explanation:**  
This use case extends the field-level permission by introducing an attribute-based rule. The permission for reading the "content" field is granted only if the document's `metadata.status` equals "published". This type of rule is helpful for enforcing extra layers of security via runtime data conditions.
