import { describe, it, expect } from "vitest";
import { Permissions } from "./permissions";
import { PermissionValidationError, ResourceDefinition } from "./types";

interface Document {
  status: string;
  members: Array<{ userId: string; role: string }>;
  // other fields can be added as needed
}

type DocumentActions = "read" | "write";

type ObjectTypes = {
  document: ResourceDefinition<Document, DocumentActions>;
};

describe("Permissions Serialization", () => {
  it("should serialize and deserialize permissions correctly", () => {
    const permissions = new Permissions<ObjectTypes>([
      {
        subject: { id: "1", role: "admin" },
        action: "read",
        object: "document",
        fields: ["title", "content"],
        conditions: [
          {
            field: "status",
            operator: "eq",
            value: "published",
          },
        ],
        type: "allow",
      },
    ]);

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
    const permissions = new Permissions<any>([
      {
        subject: { id: "1", role: "admin" },
        action: "read",
        object: "document",
        fields: ["title", "content"],
        conditions: [],
        type: "allow",
      },
    ]);

    const dto = permissions.toDTO();
    const deserialized = Permissions.fromDTO(dto);

    expect(deserialized).toBeInstanceOf(Permissions);
    expect(deserialized.toDTO()).toEqual(dto);
  });
});

describe("Permissions Field Matching", () => {
  it("should match fields with wildcards", () => {
    const permissions = new Permissions<any>([
      {
        subject: { id: "1", role: "admin" },
        action: "read",
        object: "document",
        fields: ["metadata.*", "comments.*.text"],
        conditions: [],
        type: "allow",
      },
    ]);

    const result = permissions.check({
      subject: { id: "1", role: "admin" },
      action: "read",
      object: "document",
      field: "metadata.title",
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
      field: "comments.0.text",
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
    const permissions = new Permissions<any>([
      {
        subject: { id: "1", role: "admin" },
        action: "read",
        object: "document",
        fields: ["*"],
        conditions: [],
        type: "allow",
      },
    ]);

    const result = permissions.check({
      subject: { id: "1", role: "admin" },
      action: "read",
      object: "document",
      field: "metadata.title",
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
    const permissions = new Permissions<ObjectTypes>([
      {
        subject: { id: "1", role: "admin" },
        action: "read",
        object: "document",
        fields: ["*"],
        conditions: [
          {
            field: "members",
            operator: "in",
            value: { userId: "1", role: "member" },
          },
        ],
        type: "allow",
      },
    ]);

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
    const permissions = new Permissions<any>([
      {
        subject: { id: "1", role: "admin" },
        action: "read",
        object: "document",
        fields: ["*"],
        conditions: [
          {
            field: "members",
            operator: "nin",
            value: { userId: "1", role: "member" },
          },
        ],
        type: "allow",
      },
    ]);

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
