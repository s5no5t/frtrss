import {
  Permission,
  Condition,
  PathsToStringProps,
  PermissionsDTO,
  PermissionRuleDTO,
  PermissionValidationError,
} from "./types";
import { validateDTO } from "./validation";

/**
 * A class that manages and evaluates permissions for a given data type T.
 * @template T The type of data that permissions will be checked against
 */
export class Permissions<T> {
  /**
   * Creates a new Permissions instance
   * @param permissions An array of Permission objects that define the rules
   */
  constructor(private permissions: Array<Permission<T, any>>) {}

  /**
   * Checks if a given request is allowed based on the defined permissions
   * @param params The permission check parameters
   * @param params.subject The subject requesting access
   * @param params.action The action being performed
   * @param params.object The object being accessed
   * @param params.field The specific field being accessed
   * @param params.data The data being evaluated
   * @returns boolean True if the request is allowed, false otherwise
   */
  check(params: {
    subject: any;
    action: string;
    object: string;
    field: string;
    data: T;
  }): boolean {
    const { subject, action, object, field, data } = params;

    // Default to deny
    let allowed = false;

    for (const permission of this.permissions) {
      // Check if permission applies to this request
      if (
        this.matchesSubject(permission.subject, subject) &&
        permission.action === action &&
        permission.object === object &&
        this.matchesField(permission.fields, field)
      ) {
        // Check conditions
        const conditionsMet = permission.conditions.every((condition) =>
          this.evaluateCondition(condition, data)
        );

        if (conditionsMet) {
          if (permission.type === "allow") {
            allowed = true;
          } else {
            return false; // Explicit deny takes precedence
          }
        }
      }
    }

    return allowed;
  }

  private matchesSubject(permissionSubject: any, requestSubject: any): boolean {
    return Object.entries(permissionSubject).every(
      ([key, value]) => requestSubject[key] === value
    );
  }

  private matchesField(
    permissionFields: Array<string>,
    requestField: string
  ): boolean {
    return permissionFields.some((field) => {
      if (field === "*") return true;
      if (field === requestField) return true;

      const fieldParts = field.split(".");
      const requestParts = requestField.split(".");

      if (fieldParts.length !== requestParts.length) return false;

      return fieldParts.every(
        (part, index) => part === "*" || part === requestParts[index]
      );
    });
  }

  private evaluateCondition(
    condition: Condition<T, PathsToStringProps<T>>,
    data: T
  ): boolean {
    const value = this.getFieldValue(data, condition.field);

    switch (condition.operator) {
      case "eq":
        return value === condition.value;
      case "ne":
        return value !== condition.value;
      case "gt":
        return value > condition.value;
      case "gte":
        return value >= condition.value;
      case "lt":
        return value < condition.value;
      case "lte":
        return value <= condition.value;
      case "in":
        return (
          Array.isArray(value) &&
          value.some((item) =>
            typeof item === "object" && item !== null
              ? Object.entries(item as Record<string, unknown>).every(
                  ([k, v]) =>
                    (condition.value as Record<string, unknown>)[k] === v
                )
              : item === condition.value
          )
        );
      case "nin":
        return (
          Array.isArray(value) &&
          !value.some((item) =>
            typeof item === "object" && item !== null
              ? Object.entries(item as Record<string, unknown>).every(
                  ([k, v]) =>
                    (condition.value as Record<string, unknown>)[k] === v
                )
              : item === condition.value
          )
        );
      case "size":
        return Array.isArray(value) && value.length === condition.value;
      default:
        return false;
    }
  }

  private getFieldValue(obj: any, path: string): any {
    return path.split(".").reduce((current, part) => {
      if (current === undefined) return undefined;
      if (part === "*" && Array.isArray(current)) {
        return current[0];
      }
      return current[part];
    }, obj);
  }

  /**
   * Converts the permissions to a DTO format for serialization
   * @returns PermissionsDTO The permissions in DTO format
   */
  toDTO(): PermissionsDTO {
    const rules: PermissionRuleDTO[] = this.permissions.map((permission) => ({
      effect: permission.type,
      subject: permission.subject,
      action: permission.action,
      object: permission.object,
      fields: permission.fields,
      conditions:
        permission.conditions.length > 0 ? permission.conditions : undefined,
    }));

    return {
      version: 1,
      rules,
    };
  }

  /**
   * Creates a Permissions instance from a DTO
   * @template T The type of data that permissions will be checked against
   * @param dto The DTO to create permissions from
   * @param validate Whether to validate the DTO using zod schema
   * @returns Permissions<T> A new Permissions instance
   * @throws PermissionValidationError if the DTO is invalid
   */
  static fromDTO<T>(dto: unknown, validate = false): Permissions<T> {
    try {
      const parsedDTO = validate
        ? validateDTO(dto, true)
        : (dto as PermissionsDTO);

      const permissions: Array<Permission<T, any>> = parsedDTO.rules.map(
        (rule) => ({
          type: rule.effect,
          subject: rule.subject,
          action: rule.action,
          object: rule.object,
          fields: rule.fields,
          conditions: (rule.conditions || []).map(
            (condition) =>
              ({
                field: condition.field,
                operator: condition.operator,
                value: condition.value,
              } as Condition<T, PathsToStringProps<T>>)
          ),
        })
      );

      return new Permissions<T>(permissions);
    } catch (error) {
      throw new PermissionValidationError(
        error instanceof Error ? error.message : "Invalid permissions DTO"
      );
    }
  }
}
