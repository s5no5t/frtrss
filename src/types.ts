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

export type ComparisonOperator = "eq" | "gt" | "gte" | "lt" | "lte";
export type ArrayOperator = "contains";
export type Operator = ComparisonOperator | ArrayOperator;

export type TypedCondition<T, P extends PathsToStringProps<T>> = {
  field: P;
  operator: ValueAtPath<T, P> extends Array<infer U>
    ? ArrayOperator
    : ComparisonOperator;
  value: ValueAtPath<T, P> extends Array<infer U> ? U : ValueAtPath<T, P>;
};

export type Permission<T, S> = {
  subject: S;
  action: string;
  object: string;
  fields: string[];
  conditions: Array<TypedCondition<T, PathsToStringProps<T>>>;
  type: "allow" | "deny";
};

export type PermissionCheck<T> = {
  subject: any;
  action: string;
  object: string;
  field: string;
  data: DeepPartial<T>;
};
