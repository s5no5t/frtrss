import { z } from "zod";
import type { PermissionRuleDTO, PermissionsDTO } from "./types";

/**
 * Validates a permissions DTO using zod schema validation
 * @param dto The DTO to validate
 * @param shouldValidate Whether to perform validation (if false, returns dto as-is)
 * @returns PermissionsDTO The validated DTO
 * @throws Error if validation fails
 */
export function validateDTO(
  dto: unknown,
  shouldValidate = false
): PermissionsDTO {
  if (!shouldValidate) {
    return dto as PermissionsDTO;
  }

  let zodSchema: z.ZodType<PermissionsDTO>;
  try {
    const permissionConditionSchema = z
      .object({
        field: z.string(),
        operator: z.enum(["eq", "ne", "in", "nin", "gt", "gte", "lt", "lte"]),
        value: z.unknown(),
      })
      .strict();

    const permissionRuleSchema = z
      .object({
        effect: z.enum(["allow", "deny"]),
        subject: z.unknown(),
        action: z.string(),
        object: z.string(),
        fields: z.array(z.string()),
        conditions: z.array(permissionConditionSchema).optional(),
      })
      .strict() as z.ZodType<PermissionRuleDTO>;

    zodSchema = z
      .object({
        version: z.literal(1),
        rules: z.array(permissionRuleSchema),
      })
      .strict();
  } catch {
    // zod not available, fall back to basic validation
    return validateWithoutZod(dto);
  }

  try {
    return zodSchema.parse(dto);
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : "Invalid permissions DTO"
    );
  }
}

function validateWithoutZod(dto: unknown): PermissionsDTO {
  const typedDto = dto as PermissionsDTO;
  if (
    typeof typedDto !== "object" ||
    !typedDto ||
    typedDto.version !== 1 ||
    !Array.isArray(typedDto.rules)
  ) {
    throw new Error(
      "Invalid permissions DTO: basic structure validation failed"
    );
  }

  for (const rule of typedDto.rules) {
    if (
      typeof rule !== "object" ||
      !rule ||
      (rule.effect !== "allow" && rule.effect !== "deny") ||
      typeof rule.action !== "string" ||
      typeof rule.object !== "string" ||
      !Array.isArray(rule.fields) ||
      !rule.fields.every((f) => typeof f === "string") ||
      (rule.conditions &&
        (!Array.isArray(rule.conditions) ||
          !rule.conditions.every(
            (c) =>
              typeof c === "object" &&
              c &&
              typeof c.field === "string" &&
              typeof c.operator === "string" &&
              ["eq", "ne", "in", "nin", "gt", "gte", "lt", "lte"].includes(
                c.operator
              )
          )))
    ) {
      throw new Error("Invalid permissions DTO: rule validation failed");
    }
  }
  return typedDto;
}
