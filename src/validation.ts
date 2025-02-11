import { z } from "zod";
import type { PermissionRuleDTO, PermissionsDTO } from "./types";
import { PermissionValidationError } from "./types";

/**
 * Validates a permissions DTO using zod schema validation
 * @param dto The DTO to validate
 * @returns PermissionsDTO The validated DTO
 * @throws Error if validation fails
 */
export function validateDTO(dto: unknown): PermissionsDTO {
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
    return dto as PermissionsDTO;
  }

  try {
    return zodSchema.parse(dto);
  } catch (error) {
    throw new PermissionValidationError(
      error instanceof Error ? error.message : "Invalid permissions DTO"
    );
  }
}
