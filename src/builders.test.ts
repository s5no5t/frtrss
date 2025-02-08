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
        reviewers: ["user1", "user2"],
      } as Document,
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
