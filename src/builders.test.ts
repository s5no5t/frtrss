import { describe, it, expect } from "vitest";
import { PermissionBuilder } from "./builders";

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

interface Article {
  id: string;
  title: string;
  status: "draft" | "published";
  category: string;
  tags: string[];
  authorId: string;
}

type ResourceType = {
  document: Document;
  article: Article;
};

describe("PermissionBuilder", () => {
  it("should allow access when conditions are met", () => {
    const permissions = new PermissionBuilder<ResourceType>()
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
    const permissions = new PermissionBuilder<ResourceType>()
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
    const permissions = new PermissionBuilder<ResourceType>()
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
    const permissions = new PermissionBuilder<ResourceType>()
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
    const permissions = new PermissionBuilder<ResourceType>()
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

  it("should deny access when action is a substring of allowed action", () => {
    const permissions = new PermissionBuilder<ResourceType>()
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
      action: "up",
      object: "document",
      field: "content",
      data: {
        metadata: { status: "published" },
      } as Document,
    });

    expect(result).toBe(false);
  });

  it("should deny access when action is a superstring of allowed action", () => {
    const permissions = new PermissionBuilder<ResourceType>()
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
      action: "readwrite",
      object: "document",
      field: "content",
      data: {
        metadata: { status: "published" },
      } as Document,
    });

    expect(result).toBe(false);
  });

  it("should deny access when object doesn't match", () => {
    const permissions = new PermissionBuilder<ResourceType>()
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
      object: "Article" as keyof ResourceType,
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
    const permissions = new PermissionBuilder<ResourceType>()
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
      object: "Doc" as keyof ResourceType,
      field: "content",
      data: {
        metadata: { status: "published" },
      } as Document,
    });

    expect(result).toBe(false);
  });

  it("should deny access when object is a superstring of allowed object", () => {
    const permissions = new PermissionBuilder<ResourceType>()
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
      object: "DocumentType" as keyof ResourceType,
      field: "content",
      data: {
        metadata: { status: "published" },
      } as Document,
    });

    expect(result).toBe(false);
  });

  it("should deny access when object has different casing", () => {
    const permissions = new PermissionBuilder<ResourceType>()
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
      object: "Document" as keyof ResourceType,
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
    const permissions = new PermissionBuilder<ResourceType>()
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

  it("should support array in operator", () => {
    const permissions = new PermissionBuilder<ResourceType>()
      .allow<User>({ id: "1", role: "editor" })
      .to("read")
      .on("document")
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
      object: "document",
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
    const permissions = new PermissionBuilder<ResourceType>()
      .allow<User>({ id: "1", role: "admin" })
      .to("read")
      .on("document")
      .allFields()
      .and()
      .build();

    const result = permissions.check({
      subject: { id: "1", role: "admin" },
      action: "read",
      object: "document",
      field: "author.email",
      data: {} as Document,
    });

    expect(result).toBe(true);
  });

  it("should support deny rules overriding allow rules", () => {
    const permissions = new PermissionBuilder<ResourceType>()
      .allow<User>({ id: "1", role: "editor" })
      .to("read")
      .on("document")
      .allFields()
      .and()
      .deny<User>({ id: "1", role: "editor" })
      .to("read")
      .on("document")
      .fields(["author.email"])
      .and()
      .build();

    const allowedResult = permissions.check({
      subject: { id: "1", role: "editor" },
      action: "read",
      object: "document",
      field: "content",
      data: {} as Document,
    });

    const deniedResult = permissions.check({
      subject: { id: "1", role: "editor" },
      action: "read",
      object: "document",
      field: "author.email",
      data: {} as Document,
    });

    expect(allowedResult).toBe(true);
    expect(deniedResult).toBe(false);
  });

  it("should support numeric comparisons", () => {
    const permissions = new PermissionBuilder<ResourceType>()
      .allow<User>({ id: "1", role: "editor" })
      .to("read")
      .on("document")
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
      object: "document",
      field: "content",
      data: {
        metadata: { version: 1 },
      } as Document,
    });

    const allowedResult = permissions.check({
      subject: { id: "1", role: "editor" },
      action: "read",
      object: "document",
      field: "content",
      data: {
        metadata: { version: 2 },
      } as Document,
    });

    expect(deniedResult).toBe(false);
    expect(allowedResult).toBe(true);
  });

  it("should support not equal operator", () => {
    const permissions = new PermissionBuilder<ResourceType>()
      .allow<User>({ id: "1", role: "editor" })
      .to("read")
      .on("document")
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
      object: "document",
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
      object: "document",
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
    const permissions = new PermissionBuilder<ResourceType>()
      .allow<User>({ id: "1", role: "editor" })
      .to("read")
      .on("document")
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
      object: "document",
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
      object: "document",
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
    const permissions = new PermissionBuilder<ResourceType>()
      .allow<User>({ id: "1", role: "editor" })
      .to("read")
      .on("document")
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
      object: "document",
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
      object: "document",
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

  it("should support multiple actions", () => {
    const permissions = new PermissionBuilder<ResourceType>()
      .allow<User>({ id: "1", role: "editor" })
      .to(["read", "list"])
      .on("document")
      .fields(["metadata.title", "content"])
      .when({
        field: "metadata.status",
        operator: "eq",
        value: "published",
      })
      .build();

    const data = {
      metadata: { status: "published" },
    } as Document;

    const readResult = permissions.check({
      subject: { id: "1", role: "editor" },
      action: "read",
      object: "document",
      field: "content",
      data,
    });

    const listResult = permissions.check({
      subject: { id: "1", role: "editor" },
      action: "list",
      object: "document",
      field: "content",
      data,
    });

    const writeResult = permissions.check({
      subject: { id: "1", role: "editor" },
      action: "write",
      object: "document",
      field: "content",
      data,
    });

    expect(readResult).toBe(true);
    expect(listResult).toBe(true);
    expect(writeResult).toBe(false);
  });

  it("should support multiple actions with deny rules", () => {
    const permissions = new PermissionBuilder<ResourceType>()
      .allow<User>({ id: "1", role: "editor" })
      .to(["read", "write", "list"])
      .on("document")
      .allFields()
      .and()
      .deny<User>({ id: "1", role: "editor" })
      .to(["write", "delete"])
      .on("document")
      .allFields()
      .and()
      .build();

    const data = {} as Document;

    const readResult = permissions.check({
      subject: { id: "1", role: "editor" },
      action: "read",
      object: "document",
      field: "content",
      data,
    });

    const listResult = permissions.check({
      subject: { id: "1", role: "editor" },
      action: "list",
      object: "document",
      field: "content",
      data,
    });

    const writeResult = permissions.check({
      subject: { id: "1", role: "editor" },
      action: "write",
      object: "document",
      field: "content",
      data,
    });

    const deleteResult = permissions.check({
      subject: { id: "1", role: "editor" },
      action: "delete",
      object: "document",
      field: "content",
      data,
    });

    expect(readResult).toBe(true);
    expect(listResult).toBe(true);
    expect(writeResult).toBe(false);
    expect(deleteResult).toBe(false);
  });

  describe("allowAll", () => {
    it("should allow access to any subject when using allowAll", () => {
      const permissions = new PermissionBuilder<ResourceType>()
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

    it("should still respect conditions when using allowAll", () => {
      const permissions = new PermissionBuilder<ResourceType>()
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

      const result = permissions.check({
        subject: { id: "1", role: "editor" },
        action: "read",
        object: "document",
        field: "metadata.title",
        data: {
          metadata: { status: "draft" }, // Condition not met
        } as Document,
      });

      expect(result).toBe(false);
    });

    it("should still respect action restrictions when using allowAll", () => {
      const permissions = new PermissionBuilder<ResourceType>()
        .allowAll()
        .to("read")
        .on("document")
        .fields(["metadata.title"])
        .and()
        .build();

      const readResult = permissions.check({
        subject: { id: "1", role: "editor" },
        action: "read",
        object: "document",
        field: "metadata.title",
        data: {} as Document,
      });

      const writeResult = permissions.check({
        subject: { id: "1", role: "editor" },
        action: "write",
        object: "document",
        field: "metadata.title",
        data: {} as Document,
      });

      expect(readResult).toBe(true);
      expect(writeResult).toBe(false);
    });

    it("should still respect field restrictions when using allowAll", () => {
      const permissions = new PermissionBuilder<ResourceType>()
        .allowAll()
        .to("read")
        .on("document")
        .fields(["metadata.title"])
        .and()
        .build();

      const allowedFieldResult = permissions.check({
        subject: { id: "1", role: "editor" },
        action: "read",
        object: "document",
        field: "metadata.title",
        data: {} as Document,
      });

      const restrictedFieldResult = permissions.check({
        subject: { id: "1", role: "editor" },
        action: "read",
        object: "document",
        field: "content",
        data: {} as Document,
      });

      expect(allowedFieldResult).toBe(true);
      expect(restrictedFieldResult).toBe(false);
    });
  });

  describe("Multiple Resource Types", () => {
    it("should support permissions across different resource types", () => {
      const permissions = new PermissionBuilder<ResourceType>()
        .allow<User>({ id: "1", role: "editor" })
        .to("read")
        .on("document")
        .fields(["content"])
        .when({
          field: "metadata.status",
          operator: "eq",
          value: "published",
        })
        .allow<User>({ id: "1", role: "editor" })
        .to("read")
        .on("article")
        .fields(["title", "category"])
        .when({
          field: "status",
          operator: "eq",
          value: "published",
        })
        .build();

      const documentResult = permissions.check({
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

      const articleResult = permissions.check({
        subject: { id: "1", role: "editor" },
        action: "read",
        object: "article",
        field: "title",
        data: {
          id: "1",
          title: "Test Article",
          status: "published",
          category: "test",
          tags: [],
          authorId: "1",
        } as Article,
      });

      expect(documentResult).toBe(true);
      expect(articleResult).toBe(true);
    });

    it("should correctly handle deny rules across different resource types", () => {
      const documentPermissions = new PermissionBuilder<ResourceType>()
        .allow<User>({ id: "1", role: "editor" })
        .to(["read", "write"])
        .on("document")
        .allFields()
        .and()
        .build();

      const documentDenyPermissions = new PermissionBuilder<ResourceType>()
        .deny<User>({ id: "1", role: "editor" })
        .to("write")
        .on("document")
        .fields(["metadata.status"])
        .and()
        .build();

      const articlePermissions = new PermissionBuilder<ResourceType>()
        .allow<User>({ id: "1", role: "editor" })
        .to(["read", "write"])
        .on("article")
        .allFields()
        .and()
        .build();

      const articleDenyPermissions = new PermissionBuilder<ResourceType>()
        .deny<User>({ id: "1", role: "editor" })
        .to("write")
        .on("article")
        .fields(["status"])
        .and()
        .build();

      const documentReadResult = documentPermissions.check({
        subject: { id: "1", role: "editor" },
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

      const documentWriteResult = documentDenyPermissions.check({
        subject: { id: "1", role: "editor" },
        action: "write",
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

      const articleReadResult = articlePermissions.check({
        subject: { id: "1", role: "editor" },
        action: "read",
        object: "article",
        field: "status",
        data: {
          id: "1",
          title: "Test Article",
          status: "published",
          category: "test",
          tags: [],
          authorId: "1",
        } as Article,
      });

      const articleWriteResult = articleDenyPermissions.check({
        subject: { id: "1", role: "editor" },
        action: "write",
        object: "article",
        field: "status",
        data: {
          id: "1",
          title: "Test Article",
          status: "published",
          category: "test",
          tags: [],
          authorId: "1",
        } as Article,
      });

      expect(documentReadResult).toBe(true);
      expect(documentWriteResult).toBe(false);
      expect(articleReadResult).toBe(true);
      expect(articleWriteResult).toBe(false);
    });

    it("should handle conditions independently for different resource types", () => {
      const documentPermissions = new PermissionBuilder<ResourceType>()
        .allow<User>({ id: "1", role: "editor" })
        .to("read")
        .on("document")
        .fields(["content"])
        .when({
          field: "metadata.version",
          operator: "gte",
          value: 2,
        })
        .build();

      const articlePermissions = new PermissionBuilder<ResourceType>()
        .allow<User>({ id: "1", role: "editor" })
        .to("read")
        .on("article")
        .fields(["content"])
        .when({
          field: "tags",
          operator: "size",
          value: 3,
        })
        .build();

      const documentDenied = documentPermissions.check({
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

      const documentAllowed = documentPermissions.check({
        subject: { id: "1", role: "editor" },
        action: "read",
        object: "document",
        field: "content",
        data: {
          id: "1",
          metadata: {
            status: "published",
            version: 2,
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

      const articleDenied = articlePermissions.check({
        subject: { id: "1", role: "editor" },
        action: "read",
        object: "article",
        field: "content",
        data: {
          id: "1",
          title: "Test Article",
          status: "published",
          category: "test",
          tags: ["tag1", "tag2"],
          authorId: "1",
        } as Article,
      });

      const articleAllowed = articlePermissions.check({
        subject: { id: "1", role: "editor" },
        action: "read",
        object: "article",
        field: "content",
        data: {
          id: "1",
          title: "Test Article",
          status: "published",
          category: "test",
          tags: ["tag1", "tag2", "tag3"],
          authorId: "1",
        } as Article,
      });

      expect(documentDenied).toBe(false);
      expect(documentAllowed).toBe(true);
      expect(articleDenied).toBe(false);
      expect(articleAllowed).toBe(true);
    });
  });
});
