import { describe, it, expect } from "vitest";
import { PermissionBuilder } from "./builders";
import { Permissions } from "./permissions";
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
