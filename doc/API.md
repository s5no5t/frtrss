# frtrss API Documentation

## Table of Contents
1. [Public API Methods](#public-api-methods)
2. [Main Use Cases](#main-use-cases)
   - [Basic Permission Check](#1-basic-permission-check)
   - [Field-level Permission](#2-field-level-permission)
   - [Attribute-Based Access Control (ABAC)](#3-attribute-based-access-control-abac)
   - [Multiple Subject Types](#4-multiple-subject-types)
   - [Storing and Loading Permissions](#5-storing-and-loading-permissions)

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
  
  Available operators:
  - Comparison Operators:
    - `eq`: Equal to - checks if the field value exactly matches the specified value
    - `ne`: Not equal to - checks if the field value does not match the specified value
    - `gt`: Greater than - checks if the field value is greater than the specified value
    - `gte`: Greater than or equal to - checks if the field value is greater than or equal to the specified value
    - `lt`: Less than - checks if the field value is less than the specified value
    - `lte`: Less than or equal to - checks if the field value is less than or equal to the specified value
  
  - Array Operators:
    - `in`: Contains - checks if the specified value exists in an array field
    - `nin`: Not contains - checks if the specified value does not exist in an array field
    - `size`: Array length - checks if the array field's length matches the specified value (must be a number)

  _Usage:_  
  ```typescript
  // Using comparison operator
  .when({
    field: "metadata.status",
    operator: "eq",
    value: "published",
  })

  // Using array operator
  .when({
    field: "reviewers",
    operator: "in",
    value: "user123",
  })

  // Using array size operator
  .when({
    field: "tags",
    operator: "size",
    value: 3,
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

---

### 4. Multiple Subject Types
In real-world applications, you often need to handle different types of subjects (e.g., application users, service accounts, API clients) with different attributes and permission requirements.

**Example Code:**
```typescript
import { PermissionBuilder } from "frtrss";

// Define different subject types
interface ApplicationUser {
  type: "user";
  id: string;
  role: "admin" | "editor" | "viewer";
  department: string;
}

interface ServiceAccount {
  type: "service";
  serviceId: string;
  permissions: string[];
  environment: "development" | "production";
}

interface Document {
  id: string;
  metadata: {
    title: string;
    status: "draft" | "published" | "archived";
    department: string;
  };
  content: string;
}

// Create separate permission builders for different subject types
const permissions = new PermissionBuilder<Document>()
  // Allow application users from the same department
  .allow<ApplicationUser>({ 
    type: "user",
    id: "user-1",
    role: "editor",
    department: "engineering"
  })
  .to("write")
  .on("Document")
  .when({
    field: "metadata.department",
    operator: "eq",
    value: "engineering"
  })
  // Allow service accounts in production
  .allow<ServiceAccount>({
    type: "service",
    serviceId: "backup-service",
    permissions: ["read_all"],
    environment: "production"
  })
  .to("read")
  .on("Document")
  .build();

// Check permissions for an application user
const canUserWrite = permissions.check({
  subject: {
    type: "user",
    id: "user-1",
    role: "editor",
    department: "engineering"
  },
  action: "write",
  object: "Document",
  field: "content",
  data: {
    metadata: { 
      department: "engineering",
      status: "draft"
    }
  }
});

// Check permissions for a service account
const canServiceRead = permissions.check({
  subject: {
    type: "service",
    serviceId: "backup-service",
    permissions: ["read_all"],
    environment: "production"
  },
  action: "read",
  object: "Document",
  field: "content",
  data: {
    metadata: { 
      department: "engineering",
      status: "published"
    }
  }
});

console.log(`Application user can write: ${canUserWrite}`);
console.log(`Service account can read: ${canServiceRead}`);
```

**Explanation:**  
This example demonstrates how to handle different types of subjects with distinct attributes and permission requirements:
- Application users are granted write access only to documents within their department
- Service accounts are given read-only access across all departments when running in production
- Each subject type has its own set of attributes that can be used in permission rules
- The permission builder can handle multiple subject types in a type-safe manner using TypeScript generics

### 5. Storing and Loading Permissions

The library provides a robust DTO (Data Transfer Object) system for serializing and deserializing permissions, making it easy to store and load permission configurations from various storage systems like databases, files, or configuration services.

**Example Code:**
```typescript
import { PermissionBuilder, Permissions } from "frtrss";

interface Document {
  id: string;
  metadata: {
    title: string;
    status: "draft" | "published" | "archived";
    department: string;
  };
  content: string;
}

// Create permissions using the builder
const permissions = new PermissionBuilder<Document>()
  .allow({ id: "1", role: "editor" })
  .to("read")
  .on("Document")
  .fields(["metadata.title", "content"])
  .when({
    field: "metadata.status",
    operator: "eq",
    value: "published",
  })
  .build();

// Serialize permissions to DTO format
const dto = permissions.toDTO();

// Example: Store the DTO as JSON in a file or database
const jsonString = JSON.stringify(dto);
console.log("Serialized permissions:", jsonString);

// Later: Load and deserialize the permissions
const loadedDTO = JSON.parse(jsonString);

// Create a new Permissions instance from the DTO
// Optional validation can be enabled by passing true as the second argument
const loadedPermissions = Permissions.fromDTO<Document>(loadedDTO, true);

// Use the loaded permissions
const canRead = loadedPermissions.check({
  subject: { id: "1", role: "editor" },
  action: "read",
  object: "Document",
  field: "content",
  data: {
    metadata: { status: "published" }
  }
});

console.log(`Can read document: ${canRead}`); // true
```

**Key Features of the DTO System:**

1. **Version Control**
   - DTOs include a version field to support future schema changes
   - Current version is 1
   ```typescript
   interface PermissionsDTO {
     version: 1;
     rules: PermissionRuleDTO[];
   }
   ```

2. **Validation Support**
   - Built-in validation using Zod schema
   - Optional validation when deserializing
   - Throws `PermissionValidationError` for invalid DTOs
   ```typescript
   // With validation enabled
   const validated = Permissions.fromDTO(dto, true);
   
   // Without validation (no Zod)
   const unvalidated = Permissions.fromDTO(dto);
   ```

3. **Transport Format Agnostic**
   - DTOs can be serialized to any format (JSON, YAML, etc.)
   - Preserves all permission rules, conditions, and metadata
   ```typescript
   interface PermissionRuleDTO {
     effect: "allow" | "deny";
     subject: unknown;
     action: string;
     object: string;
     fields: string[];
     conditions?: Array<{
       field: string;
       operator: string;
       value: unknown;
     }>;
   }
   ```

4. **Type Safety**
   - Maintains type information during deserialization
   - Generic type parameter ensures type safety when using loaded permissions
   ```typescript
   const typedPermissions = Permissions.fromDTO<Document>(dto);
   ```

5. **Error Handling**
   - Clear error messages for validation failures
   - Graceful fallback to basic validation when Zod is not available
   ```typescript
   try {
     const permissions = Permissions.fromDTO(dto, true);
   } catch (error) {
     if (error instanceof PermissionValidationError) {
       console.error("Invalid permission configuration:", error.message);
     }
   }
   ```
