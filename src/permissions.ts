import {
  Permission,
  PermissionCheck,
  PermissionRuleDTO,
  PermissionsDTO,
  PermissionValidationError,
  Condition,
  PathsToStringProps,
  DeepPartial,
  ResourceDefinition,
  ResourceType,
  ResourceActions,
} from "./types";

/**
 * Manages a set of permission rules and provides methods for checking permissions
 * @template T The record type mapping resource types to their definitions
 */
export class Permissions<
  T extends Record<string, ResourceDefinition<any, any>>
> {
  /**
   * Creates a new Permissions instance
   * @param permissions An array of Permission objects that define the rules
   */
  constructor(private permissions: Array<Permission<T, any, keyof T>>) {}

  /**
   * Checks if a permission is granted
   * @param params The permission check parameters
   * @returns boolean Whether the permission is granted
   */
  check(params: PermissionCheck<T>): boolean {
    const { subject, action, object, field, data } = params;

    // First check for explicit deny rules
    const denyRules = this.permissions.filter(
      (p) =>
        p.type === "deny" &&
        this.matchesSubject(p.subject, subject) &&
        p.action === action &&
        this.matchesObject(p.object, object) &&
        this.matchesField(p.fields, field)
    );

    if (
      denyRules.some((rule) => this.matchesConditions(rule.conditions, data))
    ) {
      return false;
    }

    // Then check for allow rules
    const allowRules = this.permissions.filter(
      (p) =>
        p.type === "allow" &&
        this.matchesSubject(p.subject, subject) &&
        p.action === action &&
        this.matchesObject(p.object, object) &&
        this.matchesField(p.fields, field)
    );

    return allowRules.some((rule) =>
      this.matchesConditions(rule.conditions, data)
    );
  }

  /**
   * Checks if a permission is granted for an entire object
   * @param subject The subject requesting access
   * @param action The action being performed
   * @param object The object being accessed
   * @param data The data being evaluated
   * @returns boolean Whether the permission is granted
   */
  checkObject<O extends keyof T>(
    subject: any,
    action: ResourceActions<T, O>,
    object: O,
    data: ResourceType<T, O>
  ): boolean {
    return this.check({
      subject,
      action,
      object,
      field: "*",
      data,
    });
  }

  private matchesSubject(permissionSubject: any, requestSubject: any): boolean {
    // Handle wildcard subject
    if (permissionSubject === "*") {
      return true;
    }
    return Object.entries(permissionSubject).every(
      ([key, value]) => requestSubject[key] === value
    );
  }

  private matchesField(
    permissionFields: string[],
    requestField: string
  ): boolean {
    return permissionFields.some((pattern) => {
      if (pattern === "*") {
        return true;
      }
      if (pattern.includes("*")) {
        const regex = new RegExp(
          "^" + pattern.replace(/\./g, "\\.").replace(/\*/g, "[^.]+") + "$"
        );
        return regex.test(requestField);
      }
      return pattern === requestField;
    });
  }

  private matchesConditions<O extends keyof T>(
    conditions: Array<
      Condition<ResourceType<T, O>, PathsToStringProps<ResourceType<T, O>>>
    >,
    data: DeepPartial<ResourceType<T, O>>
  ): boolean {
    return conditions.every((condition) => {
      const value = this.getFieldValue(data, condition.field);
      if (value === undefined) {
        return false;
      }

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
          if (!Array.isArray(value)) {
            return false;
          }
          if (typeof condition.value === "object" && condition.value !== null) {
            return value.some((item) =>
              Object.entries(condition.value as Record<string, unknown>).every(
                ([k, v]) => item[k] === v
              )
            );
          }
          return value.includes(condition.value);
        case "nin":
          if (!Array.isArray(value)) {
            return false;
          }
          if (typeof condition.value === "object" && condition.value !== null) {
            return !value.some((item) =>
              Object.entries(condition.value as Record<string, unknown>).every(
                ([k, v]) => item[k] === v
              )
            );
          }
          return !value.includes(condition.value);
        default:
          return false;
      }
    });
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

  private matchesObject(
    permissionObject: keyof T,
    requestObject: keyof T
  ): boolean {
    return permissionObject === requestObject;
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
      object: String(permission.object),
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
   * Creates a new Permissions instance from a DTO
   * @template T The record type mapping resource types to their definitions
   * @param dto The DTO to create from
   * @returns Permissions<T> A new Permissions instance
   * @throws PermissionValidationError if the DTO is invalid
   */
  static fromDTO<T extends Record<string, ResourceDefinition<any, any>>>(
    dto: unknown
  ): Permissions<T> {
    if (
      !dto ||
      typeof dto !== "object" ||
      !("version" in dto) ||
      !("rules" in dto) ||
      dto.version !== 1 ||
      !Array.isArray(dto.rules)
    ) {
      throw new PermissionValidationError("Invalid permissions DTO format");
    }

    const permissions = dto.rules.map((rule) => {
      if (
        !rule ||
        typeof rule !== "object" ||
        !("effect" in rule) ||
        !("subject" in rule) ||
        !("action" in rule) ||
        !("object" in rule) ||
        !("fields" in rule) ||
        !Array.isArray(rule.fields)
      ) {
        throw new PermissionValidationError("Invalid permission rule format");
      }

      return {
        type: rule.effect as "allow" | "deny",
        subject: rule.subject,
        action: rule.action as string,
        object: rule.object as keyof T,
        fields: rule.fields as string[],
        conditions: (rule.conditions || []) as Array<
          Condition<
            ResourceType<T, keyof T>,
            PathsToStringProps<ResourceType<T, keyof T>>
          >
        >,
      };
    });

    return new Permissions<T>(permissions);
  }
}
