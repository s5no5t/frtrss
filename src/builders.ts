import { Permission, Condition, PathsToStringProps } from "./types";
import { Permissions } from "./permissions";

/**
 * A fluent builder for creating permission rules in a type-safe manner.
 * This builder allows you to construct permission rules step-by-step, specifying the subject, action, object, fields, and conditions.
 * It ensures that the rules are correctly structured and validated at compile-time, making it easier to manage complex permission systems.
 * 
 * Example usage:
 * ```typescript
 * const permissions = new PermissionBuilder<{ document: Document; article: Article }>()
 *   .allow<User>({ id: "1", role: "editor" })
 *   .to("read")
 *   .on("document")
 *   .fields(["metadata.title", "content"])
 *   .when({
 *     field: "metadata.status",
 *     operator: "eq",
 *     value: "published",
 *   })
 *   .build();
 * ```
 * 
 * @template T The record type mapping object types to their data types. This type parameter is used to ensure that the builder is aware of the structure of the objects being protected by the permission rules.
 * For example, if you have objects of type `Document` and `Article`, you would define `T` as `{ document: Document; article: Article; }`.
 */
export class PermissionBuilder<T extends Record<string, any>> {
  private permissions: Array<Permission<T, any>> = [];

  /**
   * Starts building an allow permission rule
   * @template S The type of the subject
   * @param subject The subject to allow
   * @returns ActionBuilder<T, S> A builder for specifying the allowed actions
   */
  allow<S>(subject: S): ActionBuilder<T, S> {
    return new ActionBuilder<T, S>(this, subject, "allow");
  }

  /**
   * Starts building an allow permission rule that applies to all subjects
   * @returns ActionBuilder<T, "*"> A builder for specifying the allowed actions for all subjects
   */
  allowAll(): ActionBuilder<T, "*"> {
    return new ActionBuilder<T, "*">(this, "*", "allow");
  }

  /**
   * Starts building a deny permission rule
   * @template S The type of the subject
   * @param subject The subject to deny
   * @returns ActionBuilder<T, S> A builder for specifying the denied actions
   */
  deny<S>(subject: S): ActionBuilder<T, S> {
    return new ActionBuilder<T, S>(this, subject, "deny");
  }

  /**
   * Adds a permission rule to the builder
   * @param permission The permission rule to add
   */
  addPermission<S>(permission: Permission<T, S>): void {
    this.permissions.push(permission);
  }

  /**
   * Builds and returns a Permissions instance with all added rules. This method should be called after all allow/deny rules have been specified.
   * @returns Permissions<T> A new Permissions instance
   */
  build(): Permissions<T> {
    return new Permissions<T>(this.permissions);
  }
}

/**
 * Builder for specifying actions in a permission rule
 * @template T The record type mapping object types to their data types
 * @template S The type of the subject
 */
class ActionBuilder<T extends Record<string, any>, S> {
  constructor(
    private builder: PermissionBuilder<T>,
    private subject: S,
    private type: "allow" | "deny"
  ) {}

  /**
   * Specifies the actions for the permission rule
   * @param actions Single action or array of actions to allow/deny
   * @returns ObjectBuilder<T, S> A builder for specifying the target object
   */
  to(actions: string | string[]): ObjectBuilder<T, S> {
    const actionArray = Array.isArray(actions) ? actions : [actions];
    return new ObjectBuilder<T, S>(
      this.builder,
      this.subject,
      this.type,
      actionArray
    );
  }
}

/**
 * Builder for specifying the target object in a permission rule
 * @template T The record type mapping object types to their data types
 * @template S The type of the subject
 */
class ObjectBuilder<T extends Record<string, any>, S> {
  constructor(
    private builder: PermissionBuilder<T>,
    private subject: S,
    private type: "allow" | "deny",
    private actions: string[]
  ) {}

  /**
   * Specifies the object the permission applies to
   * @template O The type of the object
   * @param object The target object identifier
   * @returns FieldBuilder<T, S, O> A builder for specifying the fields
   */
  on<O extends keyof T>(object: O): FieldBuilder<T, S, O> {
    return new FieldBuilder<T, S, O>(
      this.builder,
      this.subject,
      this.type,
      this.actions,
      object
    );
  }
}

/**
 * Builder for specifying fields in a permission rule
 * @template T The record type mapping object types to their data types
 * @template S The type of the subject
 * @template O The type of the object
 */
class FieldBuilder<T extends Record<string, any>, S, O extends keyof T> {
  constructor(
    private builder: PermissionBuilder<T>,
    private subject: S,
    private type: "allow" | "deny",
    private actions: string[],
    private object: O
  ) {}

  /**
   * Specifies the fields the permission applies to
   * @param fields Array of field paths
   * @returns ConditionBuilder<T, S, O> A builder for specifying conditions
   */
  fields(fields: Array<PathsToStringProps<T[O]>>): ConditionBuilder<T, S, O> {
    return new ConditionBuilder<T, S, O>(
      this.builder,
      this.subject,
      this.type,
      this.actions,
      this.object,
      fields.map((field) => String(field))
    );
  }

  /**
   * Grants permission to all fields using wildcard
   * @returns ConditionBuilder<T, S, O> A builder for specifying conditions
   */
  allFields(): ConditionBuilder<T, S, O> {
    return this.fields(["*" as PathsToStringProps<T[O]>]);
  }
}

/**
 * Builder for specifying conditions in a permission rule
 * @template T The record type mapping object types to their data types
 * @template S The type of the subject
 * @template O The type of the object
 */
class ConditionBuilder<T extends Record<string, any>, S, O extends keyof T> {
  private conditions: Array<Condition<T[O], PathsToStringProps<T[O]>>> = [];

  constructor(
    private builder: PermissionBuilder<T>,
    private subject: S,
    private type: "allow" | "deny",
    private actions: string[],
    private object: O,
    private fields: Array<string>
  ) {}

  /**
   * Adds a condition to the permission rule
   * @template P The type of the field path
   * @param condition The condition to add
   * @returns this The current condition builder for chaining
   */
  when<P extends PathsToStringProps<T[O]>>(
    condition: Condition<T[O], P>
  ): ConditionBuilder<T, S, O> {
    this.conditions.push(condition);
    this.addPermission();
    return this;
  }

  /**
   * Starts building an allow permission rule
   * @template S2 The type of the subject
   * @param subject The subject to allow
   * @returns ActionBuilder<T, S2> A builder for specifying the allowed actions
   */
  allow<S2>(subject: S2): ActionBuilder<T, S2> {
    this.addPermission();
    return new ActionBuilder<T, S2>(this.builder, subject, "allow");
  }

  /**
   * Starts building a deny permission rule
   * @template S2 The type of the subject
   * @param subject The subject to deny
   * @returns ActionBuilder<T, S2> A builder for specifying the denied actions
   */
  deny<S2>(subject: S2): ActionBuilder<T, S2> {
    this.addPermission();
    return new ActionBuilder<T, S2>(this.builder, subject, "deny");
  }

  /**
   * Builds and returns a Permissions instance with all added rules
   * @returns Permissions<T> A new Permissions instance
   */
  build(): Permissions<T> {
    this.addPermission();
    return this.builder.build();
  }

  private addPermission(): void {
    for (const action of this.actions) {
      this.builder.addPermission<S>({
        subject: this.subject,
        action,
        object: this.object,
        fields: this.fields,
        conditions: this.conditions as unknown as Array<
          Condition<T[keyof T], PathsToStringProps<T[keyof T]>>
        >,
        type: this.type,
      });
    }
  }
}
