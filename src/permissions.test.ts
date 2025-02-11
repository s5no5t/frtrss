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

interface User {
  id: string;
  role: "admin" | "editor" | "user";
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

describe("Permissions Serialization", () => {
  it("should serialize and deserialize permissions correctly", () => {
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

describe("Permissions Field Matching", () => {
  it("should match fields with wildcards", () => {
    const permissions = new PermissionBuilder<ObjectType>()
      .allow({ id: "1", role: "admin" })
      .to("read")
      .on("document")
      .fields(["metadata.status", "content"])
      .build();

    const result = permissions.check({
      subject: { id: "1", role: "admin" },
      action: "read",
      object: "document",
      field: "metadata.status",
      data: {
        id: "1",
        metadata: {
          status: "published",
          version: 1,
          title: "Test Document",
        },
        author: {
          id: "1",
          name: "John",
          email: "john@example.com",
        },
        reviewers: [],
      } as Document,
    });

    expect(result).toBe(true);

    const resultNested = permissions.check({
      subject: { id: "1", role: "admin" },
      action: "read",
      object: "document",
      field: "content",
      data: {
        id: "1",
        metadata: {
          status: "published",
          version: 1,
          title: "Test Document",
        },
        author: {
          id: "1",
          name: "John",
          email: "john@example.com",
        },
        reviewers: [],
      } as Document,
    });

    expect(resultNested).toBe(true);
  });

  it("should handle wildcard field", () => {
    const permissions = new PermissionBuilder<ObjectType>()
      .allow({ id: "1", role: "admin" })
      .to("read")
      .on("document")
      .allFields()
      .build();

    const result = permissions.check({
      subject: { id: "1", role: "admin" },
      action: "read",
      object: "document",
      field: "metadata.status",
      data: {
        id: "1",
        metadata: {
          status: "published",
          version: 1,
          title: "Test Document",
        },
        author: {
          id: "1",
          name: "John",
          email: "john@example.com",
        },
        reviewers: [],
      } as Document,
    });

    expect(result).toBe(true);
  });
});

describe("Permissions Array Conditions", () => {
  it("should handle array membership with 'in' operator", () => {
    const permissions = new PermissionBuilder<ObjectType>()
      .allow<User>({ id: "1", role: "admin" })
      .to("read")
      .on("document")
      .fields(["metadata.title", "content"])
      .when({
        field: "reviewers",
        operator: "in",
        value: "user1",
      })
      .build();

    const result = permissions.check({
      subject: { id: "1", role: "admin" },
      action: "read",
      object: "document",
      field: "content",
      data: {
        id: "1",
        metadata: { status: "published", version: 1 },
        author: { id: "1", name: "John", email: "john@example.com" },
        reviewers: ["user1", "user2"],
      } as Document,
    });

    expect(result).toBe(true);

    const resultFalse = permissions.check({
      subject: { id: "1", role: "admin" },
      action: "read",
      object: "document",
      field: "content",
      data: {
        id: "1",
        metadata: { status: "published", version: 1 },
        author: { id: "1", name: "John", email: "john@example.com" },
        reviewers: ["user2", "user3"],
      } as Document,
    });

    expect(resultFalse).toBe(false);
  });

  it("should handle array membership with 'nin' operator", () => {
    const permissions = new PermissionBuilder<ObjectType>()
      .allow<User>({ id: "1", role: "admin" })
      .to("read")
      .on("document")
      .fields(["metadata.title", "content"])
      .when({
        field: "reviewers",
        operator: "nin",
        value: "user1",
      })
      .build();

    const result = permissions.check({
      subject: { id: "1", role: "admin" },
      action: "read",
      object: "document",
      field: "content",
      data: {
        id: "1",
        metadata: { status: "published", version: 1 },
        author: { id: "1", name: "John", email: "john@example.com" },
        reviewers: ["user2", "user3"],
      } as Document,
    });

    expect(result).toBe(true);

    const resultFalse = permissions.check({
      subject: { id: "1", role: "admin" },
      action: "read",
      object: "document",
      field: "content",
      data: {
        id: "1",
        metadata: { status: "published", version: 1 },
        author: { id: "1", name: "John", email: "john@example.com" },
        reviewers: ["user1", "user2"],
      } as Document,
    });

    expect(resultFalse).toBe(false);
  });
});

describe("Permission Checks", () => {
  it("should allow access when conditions are met", () => {
    const permissions = new PermissionBuilder<ObjectType>()
      .allow<User>({ id: "1", role: "editor" })
      .to("read")
      .on("document")
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
      object: "document",
      field: "content",
      data: {
        id: "1",
        metadata: {
          status: "published",
          version: 1,
          title: "Test Document",
        },
        author: {
          id: "1",
          name: "John",
          email: "john@example.com",
        },
        reviewers: [],
      } as Document,
    });

    expect(result).toBe(true);
  });

  it("should deny access when subject ID doesn't match", () => {
    const permissions = new PermissionBuilder<ObjectType>()
      .allow<User>({ id: "1", role: "editor" })
      .to("read")
      .on("document")
      .fields(["metadata.title", "content"])
      .when({
        field: "metadata.status",
        operator: "eq",
        value: "published",
      })
      .build();

    const result = permissions.check({
      subject: { id: "2", role: "editor" },
      action: "read",
      object: "document",
      field: "content",
      data: {
        id: "1",
        metadata: {
          status: "published",
          version: 1,
          title: "Test Document",
        },
        author: {
          id: "1",
          name: "John",
          email: "john@example.com",
        },
        reviewers: [],
      } as Document,
    });

    expect(result).toBe(false);
  });

  it("should deny access when subject role doesn't match", () => {
    const permissions = new PermissionBuilder<ObjectType>()
      .allow<User>({ id: "1", role: "editor" })
      .to("read")
      .on("document")
      .fields(["metadata.title", "content"])
      .when({
        field: "metadata.status",
        operator: "eq",
        value: "published",
      })
      .build();

    const result = permissions.check({
      subject: { id: "1", role: "user" },
      action: "read",
      object: "document",
      field: "content",
      data: {
        metadata: { status: "published" },
      } as Document,
    });

    expect(result).toBe(false);
  });

  it("should deny access when both subject ID and role don't match", () => {
    const permissions = new PermissionBuilder<ObjectType>()
      .allow<User>({ id: "1", role: "editor" })
      .to("read")
      .on("document")
      .fields(["metadata.title", "content"])
      .when({
        field: "metadata.status",
        operator: "eq",
        value: "published",
      })
      .build();

    const result = permissions.check({
      subject: { id: "2", role: "user" },
      action: "read",
      object: "document",
      field: "content",
      data: {
        metadata: { status: "published" },
      } as Document,
    });

    expect(result).toBe(false);
  });

  it("should deny access when action doesn't match", () => {
    const permissions = new PermissionBuilder<ObjectType>()
      .allow<User>({ id: "1", role: "editor" })
      .to("read")
      .on("document")
      .fields(["metadata.title", "content"])
      .when({
        field: "metadata.status",
        operator: "eq",
        value: "published",
      })
      .build();

    const result = permissions.check({
      subject: { id: "1", role: "editor" },
      action: "update",
      object: "document",
      field: "content",
      data: {
        metadata: { status: "published" },
      } as Document,
    });

    expect(result).toBe(false);
  });

  it("should deny access when action is a substring of allowed action", () => {
    const permissions = new PermissionBuilder<ObjectType>()
      .allow<User>({ id: "1", role: "editor" })
      .to("update")
      .on("document")
      .fields(["metadata.title", "content"])
      .when({
        field: "metadata.status",
        operator: "eq",
        value: "published",
      })
      .build();

    const result = permissions.check({
      subject: { id: "1", role: "editor" },
      action: "update",
      object: "document",
      field: "content",
      data: {
        metadata: { status: "published" },
      } as Document,
    });

    expect(result).toBe(true);
  });

  it("should deny access when action is a superstring of allowed action", () => {
    const permissions = new PermissionBuilder<ObjectType>()
      .allow<User>({ id: "1", role: "editor" })
      .to("read")
      .on("document")
      .fields(["metadata.title", "content"])
      .when({
        field: "metadata.status",
        operator: "eq",
        value: "published",
      })
      .build();

    const result = permissions.check({
      subject: { id: "1", role: "editor" },
      action: "write",
      object: "document",
      field: "content",
      data: {
        metadata: { status: "published" },
      } as Document,
    });

    expect(result).toBe(false);
  });

  it("should deny access when object doesn't match", () => {
    const permissions = new PermissionBuilder<ObjectType>()
      .allow<User>({ id: "1", role: "editor" })
      .to("read")
      .on("document")
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
      object: "article",
      field: "content",
      data: {
        id: "1",
        title: "Test Article",
        status: "published",
        category: "test",
        tags: [],
        authorId: "1",
      } as Article,
    });

    expect(result).toBe(false);
  });

  it("should deny access when object is a substring of allowed object", () => {
    const permissions = new PermissionBuilder<ObjectType>()
      .allow<User>({ id: "1", role: "editor" })
      .to("read")
      .on("document")
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
      object: "doc" as keyof ObjectType,
      field: "content",
      data: {
        metadata: { status: "published" },
      } as Document,
    });

    expect(result).toBe(false);
  });

  it("should deny access when object is a superstring of allowed object", () => {
    const permissions = new PermissionBuilder<ObjectType>()
      .allow<User>({ id: "1", role: "editor" })
      .to("read")
      .on("document")
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
      object: "documentType" as keyof ObjectType,
      field: "content",
      data: {
        metadata: { status: "published" },
      } as Document,
    });

    expect(result).toBe(false);
  });

  it("should deny access when object has different casing", () => {
    const permissions = new PermissionBuilder<ObjectType>()
      .allow<User>({ id: "1", role: "editor" })
      .to("read")
      .on("document")
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
      object: "Document" as keyof ObjectType,
      field: "content",
      data: {
        metadata: {
          status: "published",
        },
      },
    });

    expect(result).toBe(false);
  });

  it("should deny access when conditions are not met", () => {
    const permissions = new PermissionBuilder<ObjectType>()
      .allow<User>({ id: "1", role: "editor" })
      .to("read")
      .on("document")
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
      object: "document",
      field: "content",
      data: {
        metadata: { status: "draft" },
      } as Document,
    });

    expect(result).toBe(false);
  });

  it("should allow access to any subject when using allowAll", () => {
    const permissions = new PermissionBuilder<ObjectType>()
      .allowAll()
      .to("read")
      .on("document")
      .fields(["metadata.title"])
      .when({
        field: "metadata.status",
        operator: "eq",
        value: "published",
      })
      .build();

    // Test with editor
    const editorResult = permissions.check({
      subject: { id: "1", role: "editor" },
      action: "read",
      object: "document",
      field: "metadata.title",
      data: {
        metadata: { status: "published" },
      } as Document,
    });

    // Test with user
    const userResult = permissions.check({
      subject: { id: "2", role: "user" },
      action: "read",
      object: "document",
      field: "metadata.title",
      data: {
        metadata: { status: "published" },
      } as Document,
    });

    // Test with admin
    const adminResult = permissions.check({
      subject: { id: "3", role: "admin" },
      action: "read",
      object: "document",
      field: "metadata.title",
      data: {
        metadata: { status: "published" },
      } as Document,
    });

    // Test with completely different subject type
    const customSubjectResult = permissions.check({
      subject: { customId: "123", type: "system" },
      action: "read",
      object: "document",
      field: "metadata.title",
      data: {
        metadata: { status: "published" },
      } as Document,
    });

    expect(editorResult).toBe(true);
    expect(userResult).toBe(true);
    expect(adminResult).toBe(true);
    expect(customSubjectResult).toBe(true);
  });
});
