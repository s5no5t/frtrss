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

  it("should return dto as-is when validation is disabled", () => {
    const result = validateDTO(validDTO, false);
    expect(result).toBe(validDTO);
  });

  it("should validate a correct DTO with zod", () => {
    const result = validateDTO(validDTO, true);
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
    const result = validateDTO(dtoWithoutConditions, true);
    expect(result).toEqual(dtoWithoutConditions);
  });

  describe("validateWithoutZod", () => {
    it("should validate basic structure without zod", () => {
      const result = validateDTO(validDTO, true);
      expect(result).toEqual(validDTO);
    });

    it("should throw for non-object input", () => {
      expect(() => validateDTO("not an object", true)).toThrow();
      expect(() => validateDTO(null, true)).toThrow();
      expect(() => validateDTO(undefined, true)).toThrow();
      expect(() => validateDTO(123, true)).toThrow();
    });

    it("should throw for invalid version", () => {
      expect(() => validateDTO({ version: 2, rules: [] }, true)).toThrow();
    });

    it("should throw for missing rules array", () => {
      expect(() => validateDTO({ version: 1 }, true)).toThrow();
    });

    it("should throw for invalid rules array", () => {
      expect(() =>
        validateDTO({ version: 1, rules: "not an array" }, true)
      ).toThrow();
    });

    it("should throw for invalid rule structure", () => {
      const invalidRule = {
        version: 1,
        rules: [
          {
            // Missing required fields
            effect: "invalid",
          },
        ],
      };
      expect(() => validateDTO(invalidRule, true)).toThrow();
    });

    it("should throw for invalid effect value", () => {
      const invalidEffect = {
        version: 1,
        rules: [
          {
            effect: "invalid",
            subject: { id: "1" },
            action: "read",
            object: "document",
            fields: ["title"],
          },
        ],
      };
      expect(() => validateDTO(invalidEffect, true)).toThrow();
    });

    it("should throw for invalid fields array", () => {
      const invalidFields = {
        version: 1,
        rules: [
          {
            effect: "allow",
            subject: { id: "1" },
            action: "read",
            object: "document",
            fields: [123], // Should be strings
          },
        ],
      };
      expect(() => validateDTO(invalidFields, true)).toThrow();
    });

    it("should throw for invalid conditions structure", () => {
      const invalidConditions = {
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
                // Missing field
                operator: "eq",
                value: "test",
              },
            ],
          },
        ],
      };
      expect(() => validateDTO(invalidConditions, true)).toThrow();
    });

    it("should throw for invalid condition operator", () => {
      const invalidOperator = {
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
                operator: "invalid",
                value: "test",
              },
            ],
          },
        ],
      };
      expect(() => validateDTO(invalidOperator, true)).toThrow();
    });

    it("should validate all valid condition operators", () => {
      const operators = [
        "eq",
        "ne",
        "in",
        "nin",
        "gt",
        "gte",
        "lt",
        "lte",
        "size",
      ];
      operators.forEach((operator) => {
        const dto = {
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
                  operator,
                  value: "test",
                },
              ],
            },
          ],
        };
        expect(() => validateDTO(dto, true)).not.toThrow();
      });
    });
  });
});
