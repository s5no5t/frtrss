import { describe, it, expect } from "vitest";
import { PermissionBuilder, Permissions } from "./builders";
import { PermissionValidationError } from "./types";

interface User {
  id: string;
  role: "admin" | "editor" | "user";
}

interface Document {
  id: string;
  metadata: {
    status: string;
    version: number;
    title?: string;
  };
  content?: string;
  author: {
    id: string;
    name: string;
    email: string;
  };
  reviewers: string[];
}

describe("PermissionBuilder", () => {
  it("should allow access when conditions are met", () => {
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

    const result = permissions.check({
      subject: { id: "1", role: "editor" },
      action: "read",
      object: "Document",
      field: "content",
      data: {
        metadata: { status: "published" },
      } as Document,
    });

    expect(result).toBe(true);
  });

  it("should deny access when conditions are not met", () => {
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

    const result = permissions.check({
      subject: { id: "1", role: "editor" },
      action: "read",
      object: "Document",
      field: "content",
      data: {
        metadata: { status: "draft" },
      } as Document,
    });

    expect(result).toBe(false);
  });

  it("should support array in operator", () => {
    const permissions = new PermissionBuilder<Document>()
      .allow<User>({ id: "1", role: "editor" })
      .to("read")
      .on("Document")
      .fields(["content"])
      .when({
        field: "reviewers",
        operator: "in",
        value: "user1",
      })
      .build();

    const result = permissions.check({
      subject: { id: "1", role: "editor" },
      action: "read",
      object: "Document",
      field: "content",
      data: {
        id: "1",
        metadata: { status: "published", version: 1 },
        author: { id: "1", name: "John", email: "john@example.com" },
        reviewers: ["user1", "user2"],
      },
    });

    expect(result).toBe(true);
  });

  it("should support wildcard fields", () => {
    const permissions = new PermissionBuilder<Document>()
      .allow<User>({ id: "1", role: "admin" })
      .to("read")
      .on("Document")
      .allFields()
      .and()
      .build();

    const result = permissions.check({
      subject: { id: "1", role: "admin" },
      action: "read",
      object: "Document",
      field: "author.email", // Any field should work
      data: {} as Document,
    });

    expect(result).toBe(true);
  });

  it("should support deny rules overriding allow rules", () => {
    const permissions = new PermissionBuilder<Document>()
      .allow<User>({ id: "1", role: "editor" })
      .to("read")
      .on("Document")
      .allFields()
      .and()
      .deny<User>({ id: "1", role: "editor" })
      .to("read")
      .on("Document")
      .fields(["author.email"])
      .and()
      .build();

    const allowedResult = permissions.check({
      subject: { id: "1", role: "editor" },
      action: "read",
      object: "Document",
      field: "content",
      data: {} as Document,
    });

    const deniedResult = permissions.check({
      subject: { id: "1", role: "editor" },
      action: "read",
      object: "Document",
      field: "author.email",
      data: {} as Document,
    });

    expect(allowedResult).toBe(true);
    expect(deniedResult).toBe(false);
  });

  it("should support numeric comparisons", () => {
    const permissions = new PermissionBuilder<Document>()
      .allow<User>({ id: "1", role: "editor" })
      .to("read")
      .on("Document")
      .fields(["content"])
      .when({
        field: "metadata.version",
        operator: "gte",
        value: 2,
      })
      .build();

    const deniedResult = permissions.check({
      subject: { id: "1", role: "editor" },
      action: "read",
      object: "Document",
      field: "content",
      data: {
        metadata: { version: 1 },
      } as Document,
    });

    const allowedResult = permissions.check({
      subject: { id: "1", role: "editor" },
      action: "read",
      object: "Document",
      field: "content",
      data: {
        metadata: { version: 2 },
      } as Document,
    });

    expect(deniedResult).toBe(false);
    expect(allowedResult).toBe(true);
  });

  it("should support not equal operator", () => {
    const permissions = new PermissionBuilder<Document>()
      .allow<User>({ id: "1", role: "editor" })
      .to("read")
      .on("Document")
      .fields(["content"])
      .when({
        field: "metadata.status",
        operator: "ne",
        value: "draft",
      })
      .build();

    const deniedResult = permissions.check({
      subject: { id: "1", role: "editor" },
      action: "read",
      object: "Document",
      field: "content",
      data: {
        id: "1",
        metadata: { status: "draft", version: 1 },
        author: { id: "1", name: "John", email: "john@example.com" },
        reviewers: [],
      },
    });

    const allowedResult = permissions.check({
      subject: { id: "1", role: "editor" },
      action: "read",
      object: "Document",
      field: "content",
      data: {
        id: "1",
        metadata: { status: "published", version: 1 },
        author: { id: "1", name: "John", email: "john@example.com" },
        reviewers: [],
      },
    });

    expect(deniedResult).toBe(false);
    expect(allowedResult).toBe(true);
  });

  it("should support not in operator", () => {
    const permissions = new PermissionBuilder<Document>()
      .allow<User>({ id: "1", role: "editor" })
      .to("read")
      .on("Document")
      .fields(["content"])
      .when({
        field: "reviewers",
        operator: "nin",
        value: "user3",
      })
      .build();

    const deniedResult = permissions.check({
      subject: { id: "1", role: "editor" },
      action: "read",
      object: "Document",
      field: "content",
      data: {
        id: "1",
        metadata: { status: "published", version: 1 },
        author: { id: "1", name: "John", email: "john@example.com" },
        reviewers: ["user1", "user2", "user3"],
      },
    });

    const allowedResult = permissions.check({
      subject: { id: "1", role: "editor" },
      action: "read",
      object: "Document",
      field: "content",
      data: {
        id: "1",
        metadata: { status: "published", version: 1 },
        author: { id: "1", name: "John", email: "john@example.com" },
        reviewers: ["user1", "user2"],
      },
    });

    expect(deniedResult).toBe(false);
    expect(allowedResult).toBe(true);
  });

  it("should support array size operator", () => {
    const permissions = new PermissionBuilder<Document>()
      .allow<User>({ id: "1", role: "editor" })
      .to("read")
      .on("Document")
      .fields(["content"])
      .when({
        field: "reviewers",
        operator: "size",
        value: 2,
      })
      .build();

    const deniedResult = permissions.check({
      subject: { id: "1", role: "editor" },
      action: "read",
      object: "Document",
      field: "content",
      data: {
        id: "1",
        metadata: { status: "published", version: 1 },
        author: { id: "1", name: "John", email: "john@example.com" },
        reviewers: ["user1"],
      },
    });

    const allowedResult = permissions.check({
      subject: { id: "1", role: "editor" },
      action: "read",
      object: "Document",
      field: "content",
      data: {
        id: "1",
        metadata: { status: "published", version: 1 },
        author: { id: "1", name: "John", email: "john@example.com" },
        reviewers: ["user1", "user2"],
      },
    });

    expect(deniedResult).toBe(false);
    expect(allowedResult).toBe(true);
  });
});

describe("Permissions Serialization", () => {
  it("should serialize and deserialize permissions correctly", () => {
    const originalPermissions = new PermissionBuilder<Document>()
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

    const dto = originalPermissions.toDTO();
    expect(dto.version).toBe(1);
    expect(dto.rules).toHaveLength(1);
    expect(dto.rules[0]).toEqual({
      effect: "allow",
      subject: { id: "1", role: "editor" },
      action: "read",
      object: "Document",
      fields: ["metadata.title", "content"],
      conditions: [
        {
          field: "metadata.status",
          operator: "eq",
          value: "published",
        },
      ],
    });

    const deserializedPermissions = Permissions.fromDTO<Document>(dto);
    const testData = {
      metadata: { status: "published" },
    } as Document;

    // Verify the deserialized permissions work the same as the original
    const originalResult = originalPermissions.check({
      subject: { id: "1", role: "editor" },
      action: "read",
      object: "Document",
      field: "content",
      data: testData,
    });

    const deserializedResult = deserializedPermissions.check({
      subject: { id: "1", role: "editor" },
      action: "read",
      object: "Document",
      field: "content",
      data: testData,
    });

    expect(deserializedResult).toBe(originalResult);
    expect(deserializedResult).toBe(true);
  });

  it("should throw PermissionValidationError for invalid DTO", () => {
    const invalidDTO = {
      version: 1,
      rules: [
        {
          // Missing required fields
          effect: "allow",
          subject: { id: "1" },
        },
      ],
    };

    expect(() => Permissions.fromDTO(invalidDTO)).toThrow(
      PermissionValidationError
    );
  });

  it("should handle empty conditions array", () => {
    const originalPermissions = new PermissionBuilder<Document>()
      .allow<User>({ id: "1", role: "admin" })
      .to("read")
      .on("Document")
      .allFields()
      .and()
      .build();

    const dto = originalPermissions.toDTO();
    expect(dto.rules[0].conditions).toBeUndefined();

    const deserializedPermissions = Permissions.fromDTO<Document>(dto);
    const result = deserializedPermissions.check({
      subject: { id: "1", role: "admin" },
      action: "read",
      object: "Document",
      field: "content",
      data: {} as Document,
    });

    expect(result).toBe(true);
  });
});
