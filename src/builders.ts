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

class ActionBuilder<T, S> {
  constructor(
    private builder: PermissionBuilder<T>,
    private subject: S,
    private type: "allow" | "deny"
  ) {}

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

class ObjectBuilder<T, S> {
  constructor(
    private builder: PermissionBuilder<T>,
    private subject: S,
    private type: "allow" | "deny",
    private actions: string[]
  ) {}

  on(object: string): FieldBuilder<T, S> {
    return new FieldBuilder<T, S>(
      this.builder,
      this.subject,
      this.type,
      this.actions,
      object
    );
  }
}

class FieldBuilder<T, S> {
  constructor(
    private builder: PermissionBuilder<T>,
    private subject: S,
    private type: "allow" | "deny",
    private actions: string[],
    private object: string
  ) {}

  fields(fields: Array<string>): ConditionBuilder<T, S> {
    return new ConditionBuilder<T, S>(
      this.builder,
      this.subject,
      this.type,
      this.actions,
      this.object,
      fields.map((field) => String(field))
    );
  }

  allFields(): ConditionBuilder<T, S> {
    return this.fields(["*"]);
  }
}

class ConditionBuilder<T, S> {
  private conditions: Array<Condition<T, PathsToStringProps<T>>> = [];

  constructor(
    private builder: PermissionBuilder<T>,
    private subject: S,
    private type: "allow" | "deny",
    private actions: string[],
    private object: string,
    private fields: Array<string>
  ) {}

  when<P extends PathsToStringProps<T>>(
    condition: Condition<T, P>
  ): PermissionBuilder<T> {
    this.conditions.push(condition);
    for (const action of this.actions) {
      this.builder.addPermission({
        subject: this.subject,
        action,
        object: this.object,
        fields: this.fields,
        conditions: this.conditions,
        type: this.type,
      });
    }
    return this.builder;
  }

  and(): PermissionBuilder<T> {
    for (const action of this.actions) {
      this.builder.addPermission({
        subject: this.subject,
        action,
        object: this.object,
        fields: this.fields,
        conditions: this.conditions,
        type: this.type,
      });
    }
    return this.builder;
  }
}
