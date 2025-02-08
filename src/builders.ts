import {
  Permission,
  TypedCondition,
  PathsToStringProps,
  PermissionsDTO,
  PermissionRuleDTO,
  permissionsDTOSchema,
  PermissionValidationError,
} from "./types";

export class TypedPermissionBuilder<T> {
  private permissions: Array<Permission<T, any>> = [];

  allow<S>(subject: S): TypedActionBuilder<T, S> {
    return new TypedActionBuilder<T, S>(this, subject, "allow");
  }

  deny<S>(subject: S): TypedActionBuilder<T, S> {
    return new TypedActionBuilder<T, S>(this, subject, "deny");
  }

  addPermission(permission: Permission<T, any>): void {
    this.permissions.push(permission);
  }

  build(): TypedPermissions<T> {
    return new TypedPermissions<T>(this.permissions);
  }
}

export class TypedActionBuilder<T, S> {
  constructor(
    private builder: TypedPermissionBuilder<T>,
    private subject: S,
    private type: "allow" | "deny"
  ) {}

  to(action: string): TypedObjectBuilder<T, S> {
    return new TypedObjectBuilder<T, S>(
      this.builder,
      this.subject,
      this.type,
      action
    );
  }
}

export class TypedObjectBuilder<T, S> {
  constructor(
    private builder: TypedPermissionBuilder<T>,
    private subject: S,
    private type: "allow" | "deny",
    private action: string
  ) {}

  on(object: string): TypedFieldBuilder<T, S> {
    return new TypedFieldBuilder<T, S>(
      this.builder,
      this.subject,
      this.type,
      this.action,
      object
    );
  }
}

export class TypedFieldBuilder<T, S> {
  constructor(
    private builder: TypedPermissionBuilder<T>,
    private subject: S,
    private type: "allow" | "deny",
    private action: string,
    private object: string
  ) {}

  fields(fields: Array<string>): TypedConditionBuilder<T, S> {
    return new TypedConditionBuilder<T, S>(
      this.builder,
      this.subject,
      this.type,
      this.action,
      this.object,
      fields.map((field) => String(field))
    );
  }

  allFields(): TypedConditionBuilder<T, S> {
    return this.fields(["*"]);
  }
}

export class TypedConditionBuilder<T, S> {
  private conditions: Array<TypedCondition<T, PathsToStringProps<T>>> = [];

  constructor(
    private builder: TypedPermissionBuilder<T>,
    private subject: S,
    private type: "allow" | "deny",
    private action: string,
    private object: string,
    private fields: Array<string>
  ) {}

  when<P extends PathsToStringProps<T>>(
    condition: TypedCondition<T, P>
  ): TypedPermissionBuilder<T> {
    this.conditions.push(condition as TypedCondition<T, PathsToStringProps<T>>);
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

  and(): TypedPermissionBuilder<T> {
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

export class TypedPermissions<T> {
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
    condition: TypedCondition<T, PathsToStringProps<T>>,
    data: T
  ): boolean {
    const value = this.getFieldValue(data, condition.field);

    switch (condition.operator) {
      case "eq":
        return value === condition.value;
      case "gt":
        return value > condition.value;
      case "gte":
        return value >= condition.value;
      case "lt":
        return value < condition.value;
      case "lte":
        return value <= condition.value;
      case "contains":
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
        permission.conditions.length > 0
          ? permission.conditions.map((condition) => ({
              field: String(condition.field),
              operator: condition.operator,
              value: condition.value,
            }))
          : undefined,
    }));

    return {
      version: 1,
      rules,
    };
  }

  static fromDTO<T>(dto: unknown): TypedPermissions<T> {
    const validationResult = permissionsDTOSchema.safeParse(dto);
    if (!validationResult.success) {
      throw new PermissionValidationError(
        `Invalid permissions DTO: ${validationResult.error.message}`
      );
    }

    const validatedDTO = validationResult.data;
    const permissions: Array<Permission<T, any>> = validatedDTO.rules.map(
      (rule) => ({
        type: rule.effect,
        subject: rule.subject,
        action: rule.action,
        object: rule.object,
        fields: rule.fields,
        conditions:
          rule.conditions?.map((condition) => {
            // Cast the condition to the appropriate type
            // This is safe because we've validated the DTO structure
            return {
              field: condition.field,
              operator: condition.operator,
              value: condition.value,
            } as TypedCondition<T, PathsToStringProps<T>>;
          }) ?? [],
      })
    );

    return new TypedPermissions<T>(permissions);
  }
}
