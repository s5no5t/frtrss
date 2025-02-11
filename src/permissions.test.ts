import { describe, it, expect } from "vitest";
import { Permissions } from "./permissions";
import { PermissionValidationError, ResourceDefinition } from "./types";
import { PermissionBuilder } from "./builders";

interface Document {
  status: string;
  title: string;
  content: string;
  metadata: {
    title: string;
    [key: string]: any;
  };
  comments: Array<{
    text: string;
    [key: string]: any;
  }>;
  members: Array<{ userId: string; role: string }>;
}

type DocumentActions = "read" | "write";

type ObjectTypes = {
  document: ResourceDefinition<Document, DocumentActions>;
};

describe("Permissions Serialization", () => {
  it("should serialize and deserialize permissions correctly", () => {
    const permissions = new PermissionBuilder<ObjectTypes>()
      .allow({ id: "1", role: "admin" })
      .to("read")
      .on("document")
      .fields(["title", "content"])
      .when({
        field: "status",
        operator: "eq",
        value: "published",
      })
      .build();

    const dto = permissions.toDTO();
    const deserialized = Permissions.fromDTO(dto);

    expect(deserialized).toBeInstanceOf(Permissions);
    expect(deserialized.toDTO()).toEqual(dto);
  });

  it("should throw PermissionValidationError for invalid DTO", () => {
    const invalidDTO = {
      version: 1,
      rules: [
        {
          effect: "allow",
          subject: { id: "1", role: "admin" },
          object: "document",
          fields: ["title", "content"],
          conditions: [
            {
              field: "status",
              operator: "eq",
              value: "published",
            },
          ],
        },
      ],
    };

    expect(() => Permissions.fromDTO(invalidDTO)).toThrow(
      PermissionValidationError
    );
  });

  it("should throw PermissionValidationError for invalid DTO format", () => {
    const invalidDTO = {
      version: 2,
      rules: [],
    };

    expect(() => Permissions.fromDTO(invalidDTO)).toThrow(
      PermissionValidationError
    );
  });

  it("should handle empty conditions array", () => {
    const permissions = new PermissionBuilder<ObjectTypes>()
      .allow({ id: "1", role: "admin" })
      .to("read")
      .on("document")
      .fields(["title", "content"])
      .build();

    const dto = permissions.toDTO();
    const deserialized = Permissions.fromDTO(dto);

    expect(deserialized).toBeInstanceOf(Permissions);
    expect(deserialized.toDTO()).toEqual(dto);
  });
});

describe("Permissions Field Matching", () => {
  it("should match fields with wildcards", () => {
    const permissions = new PermissionBuilder<ObjectTypes>()
      .allow({ id: "1", role: "admin" })
      .to("read")
      .on("document")
      .fields(["metadata", "comments"])
      .build();

    const result = permissions.check({
      subject: { id: "1", role: "admin" },
      action: "read",
      object: "document",
      field: "metadata",
      data: {
        metadata: {
          title: "Test Document",
        },
      },
    });

    expect(result).toBe(true);

    const resultNested = permissions.check({
      subject: { id: "1", role: "admin" },
      action: "read",
      object: "document",
      field: "comments",
      data: {
        comments: [
          {
            text: "Test Comment",
          },
        ],
      },
    });

    expect(resultNested).toBe(true);
  });

  it("should handle wildcard field", () => {
    const permissions = new PermissionBuilder<ObjectTypes>()
      .allow({ id: "1", role: "admin" })
      .to("read")
      .on("document")
      .allFields()
      .build();

    const result = permissions.check({
      subject: { id: "1", role: "admin" },
      action: "read",
      object: "document",
      field: "metadata",
      data: {
        metadata: {
          title: "Test Document",
        },
      },
    });

    expect(result).toBe(true);
  });
});

describe("Permissions Array Conditions", () => {
  it("should handle object comparison in arrays for 'in' operator", () => {
    const permissions = new PermissionBuilder<ObjectTypes>()
      .allow({ id: "1", role: "admin" })
      .to("read")
      .on("document")
      .allFields()
      .when({
        field: "members",
        operator: "in",
        value: { userId: "1", role: "member" },
      })
      .build();

    const result = permissions.check({
      subject: { id: "1", role: "admin" },
      action: "read",
      object: "document",
      field: "title",
      data: {
        members: [
          { userId: "1", role: "member" },
          { userId: "2", role: "owner" },
        ],
      },
    });

    expect(result).toBe(true);

    const resultFalse = permissions.check({
      subject: { id: "1", role: "admin" },
      action: "read",
      object: "document",
      field: "title",
      data: {
        members: [
          { userId: "2", role: "member" },
          { userId: "3", role: "owner" },
        ],
      },
    });

    expect(resultFalse).toBe(false);
  });

  it("should handle object comparison in arrays for 'nin' operator", () => {
    const permissions = new PermissionBuilder<ObjectTypes>()
      .allow({ id: "1", role: "admin" })
      .to("read")
      .on("document")
      .allFields()
      .when({
        field: "members",
        operator: "nin",
        value: { userId: "1", role: "member" },
      })
      .build();

    const result = permissions.check({
      subject: { id: "1", role: "admin" },
      action: "read",
      object: "document",
      field: "title",
      data: {
        members: [
          { userId: "2", role: "member" },
          { userId: "3", role: "owner" },
        ],
      },
    });

    expect(result).toBe(true);

    const resultFalse = permissions.check({
      subject: { id: "1", role: "admin" },
      action: "read",
      object: "document",
      field: "title",
      data: {
        members: [
          { userId: "1", role: "member" },
          { userId: "2", role: "owner" },
        ],
      },
    });

    expect(resultFalse).toBe(false);
  });
});
