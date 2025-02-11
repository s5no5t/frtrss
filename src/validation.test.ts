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

  describe("validateWithoutZod", () => {
    it("should validate basic structure without zod", () => {
      const result = validateDTO(validDTO);
      expect(result).toEqual(validDTO);
    });

    it("should throw for non-object input", () => {
      expect(() => validateDTO("not an object")).toThrow();
      expect(() => validateDTO(null)).toThrow();
      expect(() => validateDTO(undefined)).toThrow();
      expect(() => validateDTO(123)).toThrow();
    });

    it("should throw for invalid version", () => {
      expect(() => validateDTO({ version: 2, rules: [] })).toThrow();
    });

    it("should throw for missing rules array", () => {
      expect(() => validateDTO({ version: 1 })).toThrow();
    });

    it("should throw for invalid rules array", () => {
      expect(() =>
        validateDTO({ version: 1, rules: "not an array" })
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
      expect(() => validateDTO(invalidRule)).toThrow();
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
      expect(() => validateDTO(invalidEffect)).toThrow();
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
      expect(() => validateDTO(invalidFields)).toThrow();
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
      expect(() => validateDTO(invalidConditions)).toThrow();
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
      expect(() => validateDTO(invalidOperator)).toThrow();
    });

    it("should validate all valid condition operators", () => {
      const operators = ["eq", "ne", "in", "nin", "gt", "gte", "lt", "lte"];
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
        expect(() => validateDTO(dto)).not.toThrow();
      });
    });
  });
});
