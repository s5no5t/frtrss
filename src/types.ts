export type Primitive = string | number | boolean | null;

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type PathsToStringProps<T> = T extends object
  ? {
      [K in keyof T]: K extends string
        ? T[K] extends object
          ? K | `${K}.${PathsToStringProps<T[K]>}`
          : K
        : never;
    }[keyof T]
  : never;

export type ValueAtPath<T, P extends string> = P extends keyof T
  ? T[P]
  : P extends `${infer K}.${infer R}`
  ? K extends keyof T
    ? ValueAtPath<T[K], R>
    : never
  : never;

export type ComparisonOperator = "eq" | "ne" | "gt" | "gte" | "lt" | "lte";
export type ArrayOperator = "in" | "nin" | "size";
export type Operator = ComparisonOperator | ArrayOperator;

export type ArraySizeCondition<T, P extends PathsToStringProps<T>> = {
  field: P;
  operator: "size";
  value: number;
};

export type ArrayValueCondition<T, P extends PathsToStringProps<T>> = {
  field: P;
  operator: "in" | "nin";
  value: ValueAtPath<T, P> extends Array<infer E> ? E : never;
};

export type ValueCondition<T, P extends PathsToStringProps<T>> = {
  field: P;
  operator: ComparisonOperator;
  value: ValueAtPath<T, P>;
};

export type Condition<T, P extends PathsToStringProps<T>> = ValueAtPath<
  T,
  P
> extends Array<any>
  ? ArraySizeCondition<T, P> | ArrayValueCondition<T, P>
  : ValueCondition<T, P>;

export type Permission<T, S> = {
  subject: S;
  action: string;
  object: string;
  fields: string[];
  conditions: Array<Condition<T, PathsToStringProps<T>>>;
  type: "allow" | "deny";
};

export type PermissionCheck<T> = {
  subject: any;
  action: string;
  object: string;
  field: string;
  data: DeepPartial<T>;
};

// Serialization types
export interface PermissionConditionDTO {
  field: string;
  operator: string;
  value: unknown;
}

export interface PermissionRuleDTO {
  effect: "allow" | "deny";
  subject: unknown;
  action: string;
  object: string;
  fields: string[];
  conditions?: PermissionConditionDTO[];
}

export interface PermissionsDTO {
  version: 1;
  rules: PermissionRuleDTO[];
}

export class PermissionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermissionValidationError";
  }
}
