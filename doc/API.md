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

/**
 * A fluent builder for creating permission rules in a type-safe manner.
 * This builder allows you to construct permission rules step-by-step, specifying the subject, action, object, fields, and conditions.
 * It ensures that the rules are correctly structured and validated at compile-time, making it easier to manage complex permission systems.
 * 
 * Example usage:
 * ```typescript
 * const permissions = new PermissionBuilder<{ document: Document; article: Article }>()
 *   .allow<User>({ id: "1", role: "editor" })
 *   .to("read")
 *   .on("document")
 *   .fields(["metadata.title", "content"])
 *   .when({
 *     field: "metadata.status",
 *     operator: "eq",
 *     value: "published",
 *   })
 *   .build();
 * ```
 * 
 * @template T The record type mapping object types to their data types. This type parameter is used to ensure that the builder is aware of the structure of the objects being protected by the permission rules.
 * For example, if you have objects of type `Document` and `Article`, you would define `T` as `{ document: Document; article: Article; }`.
 */

### `PermissionBuilder<T extends Record<string, any>>`
The `PermissionBuilder` class is the main entry point for creating your permission policies. It is a generic builder that lets you configure permissions based on a record type `T` that maps object types to their data types. All methods return the builder instance, allowing for fluent method chaining.

**Public Methods:**

- **`allow<S>(subject: S): PermissionBuilder<T>`**  
  Registers a subject (for example, a user or service) that is allowed permission.  
  _Usage:_  
  ```typescript
  new PermissionBuilder<{ document: Document }>()
    .allow({ id: "1", role: "editor" })    // Start building a permission rule
    // ... chain other methods to complete the rule ...
  ```

- **`allowAll(): PermissionBuilder<T>`**  
  Registers a wildcard permission that applies to all subjects. This is useful for defining public access rules.  
  _Usage:_  
  ```typescript
  new PermissionBuilder<{ document: Document }>()
    .allowAll()                            // Start building a public access rule
    // ... chain other methods to complete the rule ...
  ```

- **`deny<S>(subject: S): PermissionBuilder<T>`**  
  Registers a subject that is explicitly denied permission. Deny rules take precedence over allow rules.  
  _Usage:_  
  ```typescript
  new PermissionBuilder<{ document: Document }>()
    .deny({ id: "2", role: "user" })       // Start building a deny rule
    // ... chain other methods to complete the rule ...
  ```

- **`to(action: string | string[]): PermissionBuilder<T>`**  
  Specifies the action(s) that the permission applies to (e.g., "read", "write"). Can accept either a single action string or an array of actions.  
  _Usage:_  
  ```typescript
  // ... after allow() or deny() ...
    .to("read")                            // Chain single action
    // ... continue chaining ...

  // Or with multiple actions
    .to(["read", "write", "delete"])       // Chain multiple actions
    // ... continue chaining ...
  ```

- **`on<O extends keyof T>(object: O): PermissionBuilder<T>`**  
  Defines the resource (object) the permission is related to. The object must be a key of the type mapping record T.  
  _Usage:_  
  ```typescript
  // ... after to() ...
    .on("document")                        // Chain the target object
    // ... continue chaining ...
  ```

- **`fields(fieldList: Array<PathsToStringProps<T[O]>>): PermissionBuilder<T>`**  
  Restricts the permission to specific fields of the target resource. Field paths are provided as an array of strings. Supports wildcards for flexible field matching.  
  _Usage:_  
  ```typescript
  // ... after on() ...
    // Chain specific fields
    .fields(["metadata.title", "content"])
    // ... continue chaining ...

  // Or using wildcards
    .fields([
      "*",                    // All fields at root level
      "metadata.*",           // All fields under metadata
      "comments.*.text",      // The text field of all comments
      "metadata.*.published"  // The published field under any metadata subfield
    ])
    // ... continue chaining ...

  // Or use the convenience method
    .allFields()              // Chain wildcard for all fields
    // ... continue chaining ...
  ```

- **`when(condition: { field: string, operator: string, value: any }): PermissionBuilder<T>`**  
  Adds an attribute-based condition to refine the permission. Multiple `when()` calls can be chained to create AND conditions.
  The conditions are applied against the resource's data properties.
  
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

  _Usage:_  
  ```typescript
  // ... after fields() ...
    // Chain multiple conditions (AND)
    .when({
      field: "metadata.status",
      operator: "eq",
      value: "published",
    })
    .when({
      field: "metadata.version",
      operator: "gte",
      value: 2,
    })
    // ... continue chaining ...

    // Chain an array condition
    .when({
      field: "reviewers",
      operator: "in",
      value: "user123",
    })
    // ... continue chaining ...
  ```

- **`build(): Permissions<T>`**  
  Finalizes and constructs the permission policy based on the configured rules.  
  _Usage:_  
  ```typescript
  // ... after all other methods ...
    .build()                               // End the chain and build the policy
  ```

- **`check(options: { subject: any, action: string, object: keyof T, field: string, data: T[keyof T] }): boolean`**  
  Evaluates whether a given subject is permitted to perform the specified action on the object/field, based on the built policy.  
  _Usage:_  
  ```typescript
  // After building the policy
  const canRead = permissions.check({
    subject: { id: "1", role: "editor" },
    action: "read",
    object: "document",
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

// Define the object type mapping
type ObjectTypes = {
  document: Document;
};

// Build a permission policy using method chaining
const permissions = new PermissionBuilder<ObjectTypes>()
  .allow<User>({ id: "1", role: "editor" })  // Start with allowing a subject
  .to("read")                                // Chain the action
  .on("document")                            // Chain the target object
  .build();                                  // End chain and build the policy

const canRead = permissions.check({
  subject: { id: "1", role: "editor" },
  action: "read",
  object: "document",
  field: "", // No field-specific restriction
  data: {}   // Object data not needed for this basic check
});

console.log(`User can read Document: ${canRead}`);
```

**Explanation:**  
This example sets up a basic permission allowing a user with `{ id: "1", role: "editor" }` to perform the "read" action on the "document" resource. The `check` method returns a boolean indicating whether the operation is permitted.

---

### 2. Field-level Permission with Multiple Conditions
Often you may wish to restrict access to only certain parts or fields of a resource and apply multiple conditions that must all be met.

**Example Code:**
```typescript
import { PermissionBuilder } from "frtrss";

interface Document {
  id: string;
  metadata: {
    title: string;
    status: "draft" | "published" | "archived";
    version: number;
  };
  content: string;
}

type ObjectTypes = {
  document: Document;
};

const permissions = new PermissionBuilder<ObjectTypes>()
  .allow({ id: "2", role: "editor" })
  .to("read")
  .on("document")
  .fields(["metadata.title", "content"])
  .when({
    field: "metadata.status",
    operator: "eq",
    value: "published",
  })
  .when({
    field: "metadata.version",
    operator: "gte",
    value: 2,
  })
  .build();

const canReadTitle = permissions.check({
  subject: { id: "2", role: "editor" },
  action: "read",
  object: "document",
  field: "metadata.title",
  data: {
    metadata: { 
      status: "published",
      version: 3
    },
  },
});

console.log(`User can read title: ${canReadTitle}`);
```

**Explanation:**  
Here, the permission is narrowed down to specific fields within the `Document` and requires multiple conditions to be met. The access is only granted if:
1. The field being accessed is either "metadata.title" or "content"
2. The document's status is "published" AND
3. The document's version is greater than or equal to 2

---

### 3. Multiple Resource Types with Allow/Deny Rules
For more complex cases, you can define permissions across different resource types and combine allow and deny rules.

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

interface Article {
  id: string;
  title: string;
  status: "draft" | "published";
  content: string;
}

type ObjectTypes = {
  document: Document;
  article: Article;
};

const permissions = new PermissionBuilder<ObjectTypes>()
  // Allow editor to read and write all document fields
  .allow<User>({ id: "1", role: "editor" })
  .to(["read", "write"])
  .on("document")
  .allFields()
  // But deny write access to document status
  .deny<User>({ id: "1", role: "editor" })
  .to("write")
  .on("document")
  .fields(["metadata.status"])
  // Allow read access to published articles
  .allow<User>({ id: "1", role: "editor" })
  .to("read")
  .on("article")
  .allFields()
  .when({
    field: "status",
    operator: "eq",
    value: "published",
  })
  .build();

// Check document permissions
const canWriteContent = permissions.check({
  subject: { id: "1", role: "editor" },
  action: "write",
  object: "document",
  field: "content",
  data: {},
});

const canWriteStatus = permissions.check({
  subject: { id: "1", role: "editor" },
  action: "write",
  object: "document",
  field: "metadata.status",
  data: {},
});

// Check article permissions
const canReadArticle = permissions.check({
  subject: { id: "1", role: "editor" },
  action: "read",
  object: "article",
  field: "content",
  data: { status: "published" },
});

console.log(`Can write document content: ${canWriteContent}`); // true
console.log(`Can write document status: ${canWriteStatus}`);   // false
console.log(`Can read published article: ${canReadArticle}`);  // true
```

**Explanation:**  
This example demonstrates several advanced features:
1. Multiple resource types (`Document` and `Article`) in a single permission system
2. Combination of allow and deny rules, where deny takes precedence
3. Different conditions for different resource types
4. Array of actions in a single rule
5. Use of `allFields()` for broad access

### 4. Attribute-Based Access Control (ABAC)
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

const permissions = new PermissionBuilder<{ document: Document }>()
  .allow({ id: "3", role: "editor" })
  .to("read")
  .on("document")
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
  object: "document",
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
const permissions = new PermissionBuilder<{ document: Document }>()
  .allow({ id: "1", role: "editor" })
  .to("read")
  .on("document")
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
const loadedPermissions = Permissions.fromDTO<{ document: Document }>(loadedDTO, true);

// Use the loaded permissions
const canRead = loadedPermissions.check({
  subject: { id: "1", role: "editor" },
  action: "read",
  object: "document",
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
   const typedPermissions = Permissions.fromDTO<{ document: Document }>(dto);
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
