import { describe, it, expect } from "vitest";
import { Permissions } from "./permissions";
import { PermissionValidationError, ResourceDefinition } from "./types";
import { PermissionBuilder } from "./builders";

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

interface Article {
  id: string;
  title: string;
  status: "draft" | "published";
  category: string;
  tags: string[];
  authorId: string;
}

type DocumentActions = "read" | "write" | "update" | "delete" | "list";
type ArticleActions = "read" | "write" | "publish" | "unpublish";

type ObjectType = {
  document: ResourceDefinition<Document, DocumentActions>;
  article: ResourceDefinition<Article, ArticleActions>;
};

describe("Permissions", () => {
  it("should convert to and from DTO", () => {
    const permissions = new PermissionBuilder<ObjectType>()
      .allow({ id: "1", role: "admin" })
      .to("read")
      .on("document")
      .fields(["metadata.title", "content"])
      .when({
        field: "metadata.status",
        operator: "eq",
        value: "published",
      })
      .build();

    const dto = permissions.toDTO();
    const deserialized = Permissions.fromDTO(dto);

    expect(deserialized).toBeInstanceOf(Permissions);
    expect(deserialized.toDTO()).toEqual(dto);
  });

  describe("DTO Validation", () => {
    it("should throw PermissionValidationError for missing version field", () => {
      const invalidDTO = {
        rules: [],
      };

      expect(() => Permissions.fromDTO(invalidDTO)).toThrow(
        PermissionValidationError
      );
    });

    it("should throw PermissionValidationError for missing rules field", () => {
      const invalidDTO = {
        version: 1,
      };

      expect(() => Permissions.fromDTO(invalidDTO)).toThrow(
        PermissionValidationError
      );
    });

    it("should throw PermissionValidationError for invalid DTO", () => {
      const invalidDTO = {
        version: 1,
        rules: [
          {
            effect: "allow",
            subject: { id: "1", role: "admin" },
            object: "document",
            fields: ["metadata.title", "content"],
            conditions: [
              {
                field: "metadata.status",
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

    it("should validate DTO when validate is true", () => {
      const validDTO = {
        version: 1,
        rules: [
          {
            effect: "allow",
            subject: { id: "1", role: "admin" },
            action: "read",
            object: "document",
            fields: ["metadata.title", "content"],
            conditions: [
              {
                field: "metadata.status",
                operator: "eq",
                value: "published",
              },
            ],
          },
        ],
      };

      // Should not throw with validate=true and valid DTO
      expect(() => Permissions.fromDTO(validDTO, true)).not.toThrow();

      // Should throw with validate=true and invalid DTO
      const invalidDTO = {
        version: 2, // Invalid version
        rules: [],
      };
      expect(() => Permissions.fromDTO(invalidDTO, true)).toThrow();
    });

    it("should skip validation when validate is false", () => {
      const dto = {
        version: 1,
        rules: [
          {
            effect: "allow",
            subject: { id: "1", role: "admin" },
            action: "read",
            object: "document",
            fields: ["metadata.title", "content"],
          },
        ],
      };

      // Should not throw even with missing optional fields when validate=false
      expect(() => Permissions.fromDTO(dto, false)).not.toThrow();
    });

    it("should handle empty conditions array", () => {
      const permissions = new PermissionBuilder<ObjectType>()
        .allow({ id: "1", role: "admin" })
        .to("read")
        .on("document")
        .fields(["metadata.title", "content"])
        .build();

      const dto = permissions.toDTO();
      const deserialized = Permissions.fromDTO(dto);

      expect(deserialized).toBeInstanceOf(Permissions);
      expect(deserialized.toDTO()).toEqual(dto);
    });
  });
});
