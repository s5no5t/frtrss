import {
  Permission,
  Condition,
  PathsToStringProps,
  PermissionsDTO,
  PermissionRuleDTO,
  permissionsDTOSchema,
  PermissionValidationError,
} from "./types";

export class PermissionBuilder<T> {
  private permissions: Array<Permission<T, any>> = [];

  allow<S>(subject: S): ActionBuilder<T, S> {
    return new ActionBuilder<T, S>(this, subject, "allow");
  }

  deny<S>(subject: S): ActionBuilder<T, S> {
    return new ActionBuilder<T, S>(this, subject, "deny");
  }

  addPermission(permission: Permission<T, any>): void {
    this.permissions.push(permission);
  }

  build(): Permissions<T> {
    return new Permissions<T>(this.permissions);
  }
}

export class ActionBuilder<T, S> {
  constructor(
    private builder: PermissionBuilder<T>,
    private subject: S,
    private type: "allow" | "deny"
  ) {}

  to(action: string): ObjectBuilder<T, S> {
    return new ObjectBuilder<T, S>(
      this.builder,
      this.subject,
      this.type,
      action
    );
  }
}

export class ObjectBuilder<T, S> {
  constructor(
    private builder: PermissionBuilder<T>,
    private subject: S,
    private type: "allow" | "deny",
    private action: string
  ) {}

  on(object: string): FieldBuilder<T, S> {
    return new FieldBuilder<T, S>(
      this.builder,
      this.subject,
      this.type,
      this.action,
      object
    );
  }
}

export class FieldBuilder<T, S> {
  constructor(
    private builder: PermissionBuilder<T>,
    private subject: S,
    private type: "allow" | "deny",
    private action: string,
    private object: string
  ) {}

  fields(fields: Array<string>): ConditionBuilder<T, S> {
    return new ConditionBuilder<T, S>(
      this.builder,
      this.subject,
      this.type,
      this.action,
      this.object,
      fields.map((field) => String(field))
    );
  }

  allFields(): ConditionBuilder<T, S> {
    return this.fields(["*"]);
  }
}

export class ConditionBuilder<T, S> {
  private conditions: Array<Condition<T, PathsToStringProps<T>>> = [];

  constructor(
    private builder: PermissionBuilder<T>,
    private subject: S,
    private type: "allow" | "deny",
    private action: string,
    private object: string,
    private fields: Array<string>
  ) {}

  when<P extends PathsToStringProps<T>>(
    condition: Condition<T, P>
  ): PermissionBuilder<T> {
    this.conditions.push(condition);
    this.builder.addPermission({
      subject: this.subject,
      action: this.action,
      object: this.object,
      fields: this.fields,
      conditions: this.conditions,
      type: this.type,
    });
    return this.builder;
  }

  and(): PermissionBuilder<T> {
    this.builder.addPermission({
      subject: this.subject,
      action: this.action,
      object: this.object,
      fields: this.fields,
      conditions: this.conditions,
      type: this.type,
    });
    return this.builder;
  }
}

export class Permissions<T> {
  constructor(private permissions: Array<Permission<T, any>>) {}

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

  static fromDTO<T>(dto: unknown): Permissions<T> {
    try {
      const validatedDTO = permissionsDTOSchema.parse(dto);

      const permissions: Array<Permission<T, any>> = validatedDTO.rules.map(
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
