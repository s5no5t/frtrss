import { describe, it, expect } from "vitest";
import { PermissionBuilder } from "./builders";
import { ResourceDefinition } from "./types";

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

type DocumentActions = "read" | "write" | "update" | "delete" | "list";
type ArticleActions = "read" | "write" | "publish" | "unpublish";

type Objects = {
  document: ResourceDefinition<Document, DocumentActions>;
  article: ResourceDefinition<Article, ArticleActions>;
};

describe("PermissionBuilder", () => {
  describe("Deny", () => {
    it("should support deny rules overriding allow rules", () => {
      const permissions = new PermissionBuilder<Objects>()
        .allow<User>({ id: "1", role: "editor" })
        .to("read")
        .on("document")
        .allFields()
        .deny<User>({ id: "1", role: "editor" })
        .to("read")
        .on("document")
        .fields(["author.email"])
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
  });

  describe("Subject", () => {
    it("should match exact subject", () => {
      const permissions = new PermissionBuilder<Objects>()
        .allow<User>({ id: "1", role: "editor" })
        .to("read")
        .on("document")
        .allFields()
        .build();

      const matchingResult = permissions.check({
        subject: { id: "1", role: "editor" },
        action: "read",
        object: "document",
        field: "content",
        data: {} as Document,
      });

      const nonMatchingResult = permissions.check({
        subject: { id: "2", role: "editor" },
        action: "read",
        object: "document",
        field: "content",
        data: {} as Document,
      });

      expect(matchingResult).toBe(true);
      expect(nonMatchingResult).toBe(false);
    });
  });

  describe("Actions", () => {
    it("should support single action", () => {
      const permissions = new PermissionBuilder<Objects>()
        .allow<User>({ id: "1", role: "editor" })
        .to("read")
        .on("document")
        .fields(["content"])
        .when({
          field: "metadata.status",
          operator: "eq",
          value: "published",
        })
        .build();

      const data = {
        metadata: { status: "published" },
      } as Document;

      const allowedResult = permissions.check({
        subject: { id: "1", role: "editor" },
        action: "read",
        object: "document",
        field: "content",
        data,
      });

      const deniedResult = permissions.check({
        subject: { id: "1", role: "editor" },
        action: "write",
        object: "document",
        field: "content",
        data,
      });

      expect(allowedResult).toBe(true);
      expect(deniedResult).toBe(false);
    });

    it("should support multiple actions", () => {
      const permissions = new PermissionBuilder<Objects>()
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
      const permissions = new PermissionBuilder<Objects>()
        .allow<User>({ id: "1", role: "editor" })
        .to(["read", "write", "list"])
        .on("document")
        .allFields()
        .deny<User>({ id: "1", role: "editor" })
        .to(["write", "delete"])
        .on("document")
        .allFields()
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
  });

  describe("Objects", () => {
    it("should support permissions across different objects", () => {
      const permissions = new PermissionBuilder<Objects>()
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
        .fields(["title"])
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

    it("should correctly handle deny rules across different objects", () => {
      const documentPermissions = new PermissionBuilder<Objects>()
        .allow<User>({ id: "1", role: "editor" })
        .to(["read", "write"])
        .on("document")
        .allFields()
        .build();

      const documentDenyPermissions = new PermissionBuilder<Objects>()
        .deny<User>({ id: "1", role: "editor" })
        .to("write")
        .on("document")
        .fields(["metadata.status"])
        .build();

      const articlePermissions = new PermissionBuilder<Objects>()
        .allow<User>({ id: "1", role: "editor" })
        .to("read")
        .on("article")
        .fields(["title"])
        .when({
          field: "tags",
          operator: "in",
          value: "featured",
        })
        .build();

      const articleDenyPermissions = new PermissionBuilder<Objects>()
        .deny<User>({ id: "1", role: "editor" })
        .to("write")
        .on("article")
        .fields(["status"])
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
        field: "title",
        data: {
          id: "1",
          title: "Test Article",
          status: "published",
          category: "test",
          tags: ["tag1", "featured", "tag2"],
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
          tags: ["tag1", "featured", "tag2"],
          authorId: "1",
        } as Article,
      });

      expect(documentReadResult).toBe(true);
      expect(documentWriteResult).toBe(false);
      expect(articleReadResult).toBe(true);
      expect(articleWriteResult).toBe(false);
    });

    it("should handle conditions independently for different objects", () => {
      const documentPermissions = new PermissionBuilder<Objects>()
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

      const articlePermissions = new PermissionBuilder<Objects>()
        .allow<User>({ id: "1", role: "editor" })
        .to("read")
        .on("article")
        .fields(["title"])
        .when({
          field: "tags",
          operator: "in",
          value: "featured",
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
        field: "title",
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
        field: "title",
        data: {
          id: "1",
          title: "Test Article",
          status: "published",
          category: "test",
          tags: ["tag1", "featured", "tag2"],
          authorId: "1",
        } as Article,
      });

      expect(documentDenied).toBe(false);
      expect(documentAllowed).toBe(true);
      expect(articleDenied).toBe(false);
      expect(articleAllowed).toBe(true);
    });
  });

  describe("Fields", () => {
    it("should support a single field", () => {
      const permissions = new PermissionBuilder<Objects>()
        .allow<User>({ id: "1", role: "editor" })
        .to("read")
        .on("document")
        .fields(["content"])
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
        field: "metadata.title",
        data: {} as Document,
      });

      expect(allowedResult).toBe(true);
      expect(deniedResult).toBe(false);
    });

    it("should support multiple fields", () => {
      const permissions = new PermissionBuilder<Objects>()
        .allow<User>({ id: "1", role: "editor" })
        .to("read")
        .on("document")
        .fields(["content", "metadata.title"])
        .build();

      const contentResult = permissions.check({
        subject: { id: "1", role: "editor" },
        action: "read",
        object: "document",
        field: "content",
        data: {} as Document,
      });

      const titleResult = permissions.check({
        subject: { id: "1", role: "editor" },
        action: "read",
        object: "document",
        field: "metadata.title",
        data: {} as Document,
      });

      const deniedResult = permissions.check({
        subject: { id: "1", role: "editor" },
        action: "read",
        object: "document",
        field: "author.email",
        data: {} as Document,
      });

      expect(contentResult).toBe(true);
      expect(titleResult).toBe(true);
      expect(deniedResult).toBe(false);
    });

    it("should support wildcard fields", () => {
      const permissions = new PermissionBuilder<Objects>()
        .allow<User>({ id: "1", role: "admin" })
        .to("read")
        .on("document")
        .allFields()
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
  });

  describe("Conditions", () => {
    it("should support multiple conditions", () => {
      const permissions = new PermissionBuilder<Objects>()
        .allow<User>({ id: "1", role: "editor" })
        .to("read")
        .on("document")
        .fields(["content"])
        .when({
          field: "metadata.status",
          operator: "eq",
          value: "published",
        })
        .when({
          field: "metadata.version",
          operator: "gte",
          value: 2,
        })
        .build();

      const deniedResults = [
        // Status correct but version too low
        {
          metadata: { status: "published", version: 1 },
        } as Document,
        // Version correct but status wrong
        {
          metadata: { status: "draft", version: 2 },
        } as Document,
        // Both conditions wrong
        {
          metadata: { status: "draft", version: 1 },
        } as Document,
      ].map((data) =>
        permissions.check({
          subject: { id: "1", role: "editor" },
          action: "read",
          object: "document",
          field: "content",
          data,
        })
      );

      const allowedResult = permissions.check({
        subject: { id: "1", role: "editor" },
        action: "read",
        object: "document",
        field: "content",
        data: {
          metadata: { status: "published", version: 2 },
        } as Document,
      });

      expect(deniedResults.every((result) => result === false)).toBe(true);
      expect(allowedResult).toBe(true);
    });

    describe("Equality Operators", () => {
      it("should support eq operator with strings", () => {
        const permissions = new PermissionBuilder<Objects>()
          .allow<User>({ id: "1", role: "editor" })
          .to("read")
          .on("document")
          .fields(["content"])
          .when({
            field: "metadata.status",
            operator: "eq",
            value: "published",
          })
          .build();

        const deniedResult = permissions.check({
          subject: { id: "1", role: "editor" },
          action: "read",
          object: "document",
          field: "content",
          data: {
            metadata: { status: "draft", version: 1 },
          } as Document,
        });

        const allowedResult = permissions.check({
          subject: { id: "1", role: "editor" },
          action: "read",
          object: "document",
          field: "content",
          data: {
            metadata: { status: "published", version: 1 },
          } as Document,
        });

        expect(deniedResult).toBe(false);
        expect(allowedResult).toBe(true);
      });

      it("should support eq operator with numbers", () => {
        const permissions = new PermissionBuilder<Objects>()
          .allow<User>({ id: "1", role: "editor" })
          .to("read")
          .on("document")
          .fields(["content"])
          .when({
            field: "metadata.version",
            operator: "eq",
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

      it("should support ne operator", () => {
        const permissions = new PermissionBuilder<Objects>()
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
    });

    describe("Numeric Comparison Operators", () => {
      it("should support gt operator", () => {
        const permissions = new PermissionBuilder<Objects>()
          .allow<User>({ id: "1", role: "editor" })
          .to("read")
          .on("document")
          .fields(["content"])
          .when({
            field: "metadata.version",
            operator: "gt",
            value: 2,
          })
          .build();

        const deniedResults = [1, 2].map((version) =>
          permissions.check({
            subject: { id: "1", role: "editor" },
            action: "read",
            object: "document",
            field: "content",
            data: {
              metadata: { version },
            } as Document,
          })
        );

        const allowedResult = permissions.check({
          subject: { id: "1", role: "editor" },
          action: "read",
          object: "document",
          field: "content",
          data: {
            metadata: { version: 3 },
          } as Document,
        });

        expect(deniedResults.every((result) => result === false)).toBe(true);
        expect(allowedResult).toBe(true);
      });

      it("should support gte operator", () => {
        const permissions = new PermissionBuilder<Objects>()
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

        const allowedResults = [2, 3].map((version) =>
          permissions.check({
            subject: { id: "1", role: "editor" },
            action: "read",
            object: "document",
            field: "content",
            data: {
              metadata: { version },
            } as Document,
          })
        );

        expect(deniedResult).toBe(false);
        expect(allowedResults.every((result) => result === true)).toBe(true);
      });

      it("should support lt operator", () => {
        const permissions = new PermissionBuilder<Objects>()
          .allow<User>({ id: "1", role: "editor" })
          .to("read")
          .on("document")
          .fields(["content"])
          .when({
            field: "metadata.version",
            operator: "lt",
            value: 2,
          })
          .build();

        const deniedResults = [2, 3].map((version) =>
          permissions.check({
            subject: { id: "1", role: "editor" },
            action: "read",
            object: "document",
            field: "content",
            data: {
              metadata: { version },
            } as Document,
          })
        );

        const allowedResult = permissions.check({
          subject: { id: "1", role: "editor" },
          action: "read",
          object: "document",
          field: "content",
          data: {
            metadata: { version: 1 },
          } as Document,
        });

        expect(deniedResults.every((result) => result === false)).toBe(true);
        expect(allowedResult).toBe(true);
      });

      it("should support lte operator", () => {
        const permissions = new PermissionBuilder<Objects>()
          .allow<User>({ id: "1", role: "editor" })
          .to("read")
          .on("document")
          .fields(["content"])
          .when({
            field: "metadata.version",
            operator: "lte",
            value: 2,
          })
          .build();

        const deniedResult = permissions.check({
          subject: { id: "1", role: "editor" },
          action: "read",
          object: "document",
          field: "content",
          data: {
            metadata: { version: 3 },
          } as Document,
        });

        const allowedResults = [1, 2].map((version) =>
          permissions.check({
            subject: { id: "1", role: "editor" },
            action: "read",
            object: "document",
            field: "content",
            data: {
              metadata: { version },
            } as Document,
          })
        );

        expect(deniedResult).toBe(false);
        expect(allowedResults.every((result) => result === true)).toBe(true);
      });
    });

    describe("Array Membership Operators", () => {
      it("should support array in operator", () => {
        const permissions = new PermissionBuilder<Objects>()
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

      it("should support array nin operator", () => {
        const permissions = new PermissionBuilder<Objects>()
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
    });
  });
});
