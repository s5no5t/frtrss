import { describe, it, expect } from "vitest";
import { PermissionBuilder } from "./builders";
import { Permissions } from "./permissions";
import { PermissionValidationError } from "./types";

interface User {
  id: string;
  role: "admin" | "editor" | "user";
}

interface Reviewer {
  id: string;
  role: "reviewer";
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
  reviewers: Array<string | Reviewer>;
}

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

  it("should throw PermissionValidationError for invalid DTO when validation is enabled", () => {
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

    expect(() => Permissions.fromDTO(invalidDTO, true)).toThrow(
      PermissionValidationError
    );
  });

  it("should not throw PermissionValidationError for invalid DTO when validation is disabled", () => {
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

    // Should not throw when validation is disabled (default behavior)
    const permissions = Permissions.fromDTO(invalidDTO);
    expect(permissions).toBeInstanceOf(Permissions);

    // Explicitly disabled validation should also not throw
    const permissions2 = Permissions.fromDTO(invalidDTO, false);
    expect(permissions2).toBeInstanceOf(Permissions);
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

describe("Permissions Field Matching", () => {
  it("should handle field path length mismatches", () => {
    const permissions = new PermissionBuilder<Document>()
      .allow<User>({ id: "1", role: "editor" })
      .to("read")
      .on("Document")
      .fields(["metadata"])
      .and()
      .build();

    const result = permissions.check({
      subject: { id: "1", role: "editor" },
      action: "read",
      object: "Document",
      field: "metadata.title",
      data: {} as Document,
    });

    expect(result).toBe(false);
  });

  it("should handle array wildcards in field paths", () => {
    const permissions = new PermissionBuilder<Document>()
      .allow<User>({ id: "1", role: "editor" })
      .to("read")
      .on("Document")
      .fields(["reviewers.*"])
      .and()
      .build();

    const result = permissions.check({
      subject: { id: "1", role: "editor" },
      action: "read",
      object: "Document",
      field: "reviewers.0",
      data: { reviewers: ["user1", "user2"] } as Document,
    });

    expect(result).toBe(true);
  });
});

describe("Permissions Array Conditions", () => {
  it("should handle object comparison in arrays for 'in' operator", () => {
    const permissions = new PermissionBuilder<Document>()
      .allow<User>({ id: "1", role: "editor" })
      .to("read")
      .on("Document")
      .fields(["reviewers"])
      .when({
        field: "reviewers",
        operator: "in",
        value: { id: "user1", role: "reviewer" },
      })
      .build();

    const result = permissions.check({
      subject: { id: "1", role: "editor" },
      action: "read",
      object: "Document",
      field: "reviewers",
      data: {
        reviewers: [
          { id: "user1", role: "reviewer" },
          { id: "user2", role: "reviewer" },
        ],
      } as any,
    });

    expect(result).toBe(true);

    const resultFalse = permissions.check({
      subject: { id: "1", role: "editor" },
      action: "read",
      object: "Document",
      field: "reviewers",
      data: {
        reviewers: [
          { id: "user3", role: "reviewer" },
          { id: "user4", role: "reviewer" },
        ],
      } as any,
    });

    expect(resultFalse).toBe(false);
  });

  it("should handle object comparison in arrays for 'nin' operator", () => {
    const permissions = new PermissionBuilder<Document>()
      .allow<User>({ id: "1", role: "editor" })
      .to("read")
      .on("Document")
      .fields(["reviewers"])
      .when({
        field: "reviewers",
        operator: "nin",
        value: { id: "user1", role: "reviewer" },
      })
      .build();

    const result = permissions.check({
      subject: { id: "1", role: "editor" },
      action: "read",
      object: "Document",
      field: "reviewers",
      data: {
        reviewers: [
          { id: "user2", role: "reviewer" },
          { id: "user3", role: "reviewer" },
        ],
      } as any,
    });

    expect(result).toBe(true);

    const resultFalse = permissions.check({
      subject: { id: "1", role: "editor" },
      action: "read",
      object: "Document",
      field: "reviewers",
      data: {
        reviewers: [
          { id: "user1", role: "reviewer" },
          { id: "user2", role: "reviewer" },
        ],
      } as any,
    });

    expect(resultFalse).toBe(false);
  });
});
