export type Primitive = string | number | boolean | null;

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type ComparisonOperator = "eq" | "gt" | "gte" | "lt" | "lte";
export type ArrayOperator = "contains";
export type Operator = ComparisonOperator | ArrayOperator;

export type TypedCondition<T, K extends keyof T> = {
  field: K;
  operator: T[K] extends Array<any> ? ArrayOperator : ComparisonOperator;
  value: T[K];
};

export type Permission<T, S> = {
  subject: S;
  action: string;
  object: string;
  fields: string[];
  conditions: Array<TypedCondition<T, keyof T>>;
  type: "allow" | "deny";
};

export type PermissionCheck<T> = {
  subject: any;
  action: string;
  object: string;
  field: string;
  data: DeepPartial<T>;
};
