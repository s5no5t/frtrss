import { Permission, Condition, PathsToStringProps } from "./types";
import { Permissions } from "./permissions";

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
