import { describe, it, expect, vi } from "vitest";
import { validateDTO } from "./validation";

vi.mock("zod");

describe("validateDTO", () => {
  const validDTO = {
    version: 1,
    rules: [
      {
        effect: "allow",
        subject: { id: "1" },
        action: "read",
        object: "document",
        fields: ["title"],
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

  it("should validate a correct DTO with zod", () => {
    const result = validateDTO(validDTO);
    expect(result).toEqual(validDTO);
  });

  it("should validate a correct DTO without conditions", () => {
    const dtoWithoutConditions = {
      version: 1,
      rules: [
        {
          effect: "allow",
          subject: { id: "1" },
          action: "read",
          object: "document",
          fields: ["title"],
        },
      ],
    };
    const result = validateDTO(dtoWithoutConditions);
    expect(result).toEqual(dtoWithoutConditions);
  });

  it("should fall back to basic validation when zod is not available", () => {
    // Our zod mock will throw errors, simulating Zod being unavailable
    const dtoToValidate = {
      version: 1,
      rules: [
        {
          effect: "allow",
          subject: { id: "1" },
          action: "read",
          object: "document",
          fields: ["title"],
        },
      ],
    };
    const result = validateDTO(dtoToValidate);
    expect(result).toEqual(dtoToValidate);
  });
});
