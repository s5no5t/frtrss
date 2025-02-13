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
  tags: Array<{ name: string; priority?: number }>;
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

  describe("Array Conditions", () => {
    it("should handle array membership with primitive values", () => {
      const permissions = new PermissionBuilder<ObjectType>()
        .allow({ role: "admin" })
        .to("read")
        .on("document")
        .fields(["reviewers"])
        .when({
          field: "reviewers",
          operator: "in",
          value: "user1",
        })
        .build();

      expect(
        permissions.check({
          subject: { role: "admin" },
          action: "read",
          object: "document",
          field: "reviewers",
          data: { reviewers: ["user1", "user2"] },
        })
      ).toBe(true);

      expect(
        permissions.check({
          subject: { role: "admin" },
          action: "read",
          object: "document",
          field: "reviewers",
          data: { reviewers: ["user3"] },
        })
      ).toBe(false);
    });

    it("should handle array non-membership with primitive values", () => {
      const permissions = new PermissionBuilder<ObjectType>()
        .allow({ role: "admin" })
        .to("read")
        .on("document")
        .fields(["reviewers"])
        .when({
          field: "reviewers",
          operator: "nin",
          value: "user1",
        })
        .build();

      expect(
        permissions.check({
          subject: { role: "admin" },
          action: "read",
          object: "document",
          field: "reviewers",
          data: { reviewers: ["user2", "user3"] },
        })
      ).toBe(true);
    });

    it("should handle array membership with object values", () => {
      const permissions = new PermissionBuilder<ObjectType>()
        .allow({ role: "admin" })
        .to("read")
        .on("article")
        .fields(["tags"])
        .when({
          field: "tags",
          operator: "in",
          value: { name: "featured" },
        })
        .build();

      expect(
        permissions.check({
          subject: { role: "admin" },
          action: "read",
          object: "article",
          field: "tags",
          data: { tags: [{ name: "featured", priority: 1 }, { name: "news" }] },
        })
      ).toBe(true);

      expect(
        permissions.check({
          subject: { role: "admin" },
          action: "read",
          object: "article",
          field: "tags",
          data: { tags: [{ name: "news" }, { name: "tech" }] },
        })
      ).toBe(false);
    });

    it("should handle array non-membership with object values", () => {
      const permissions = new PermissionBuilder<ObjectType>()
        .allow({ role: "admin" })
        .to("read")
        .on("article")
        .fields(["tags"])
        .when({
          field: "tags",
          operator: "nin",
          value: { name: "draft" },
        })
        .build();

      expect(
        permissions.check({
          subject: { role: "admin" },
          action: "read",
          object: "article",
          field: "tags",
          data: { tags: [{ name: "published" }, { name: "featured" }] },
        })
      ).toBe(true);

      expect(
        permissions.check({
          subject: { role: "admin" },
          action: "read",
          object: "article",
          field: "tags",
          data: { tags: [{ name: "draft" }, { name: "review" }] },
        })
      ).toBe(false);
    });

    it("should handle comparison with nested object values", () => {
      const permissions = new PermissionBuilder<ObjectType>()
        .allow({ role: "admin" })
        .to("read")
        .on("document")
        .fields(["author.id"])
        .when({
          field: "author.id",
          operator: "eq",
          value: "1",
        })
        .build();

      expect(
        permissions.check({
          subject: { role: "admin" },
          action: "read",
          object: "document",
          field: "author.id",
          data: {
            author: { id: "1", name: "John", email: "john@example.com" },
          },
        })
      ).toBe(true);
    });
  });

  describe("Field Value Resolution", () => {
    it("should handle array field access", () => {
      const permissions = new PermissionBuilder<ObjectType>()
        .allow({ role: "admin" })
        .to("read")
        .on("document")
        .fields(["reviewers"])
        .when({
          field: "reviewers",
          operator: "in",
          value: "user1",
        })
        .build();

      expect(
        permissions.check({
          subject: { role: "admin" },
          action: "read",
          object: "document",
          field: "reviewers",
          data: { reviewers: ["user1", "user2"] },
        })
      ).toBe(true);

      expect(
        permissions.check({
          subject: { role: "admin" },
          action: "read",
          object: "document",
          field: "reviewers",
          data: { reviewers: [] },
        })
      ).toBe(false);
    });

    it("should handle undefined values in nested paths", () => {
      const permissions = new PermissionBuilder<ObjectType>()
        .allow({ role: "admin" })
        .to("read")
        .on("document")
        .fields(["metadata.title"])
        .when({
          field: "metadata.title",
          operator: "eq",
          value: "test",
        })
        .build();

      expect(
        permissions.check({
          subject: { role: "admin" },
          action: "read",
          object: "document",
          field: "metadata.title",
          data: { metadata: {} },
        })
      ).toBe(false);
    });
  });
});
