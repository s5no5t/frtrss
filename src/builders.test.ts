import { describe, it, expect } from "vitest";
import { TypedPermissionBuilder } from "./builders";

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

describe("TypedPermissionBuilder", () => {
  it("should allow access when conditions are met", () => {
    const permissions = new TypedPermissionBuilder<Document>()
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
    const permissions = new TypedPermissionBuilder<Document>()
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

  it("should support array contains operator", () => {
    const permissions = new TypedPermissionBuilder<Document>()
      .allow<User>({ id: "1", role: "editor" })
      .to("read")
      .on("Document")
      .fields(["content"])
      .when({
        field: "reviewers",
        operator: "contains",
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
    const permissions = new TypedPermissionBuilder<Document>()
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
    const permissions = new TypedPermissionBuilder<Document>()
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
    const permissions = new TypedPermissionBuilder<Document>()
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
