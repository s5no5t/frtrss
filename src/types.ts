export type Primitive = string | number | boolean | null;

/**
 * Makes all properties in T optional recursively
 */
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

/**
 * Represents a permission rule that defines access control
 * @template T The type of data that permissions will be checked against
 * @template S The type of the subject
 */
export type Permission<T, S> = {
  /** The subject requesting access */
  subject: S;
  /** The action being performed */
  action: string;
  /** The object being accessed */
  object: string;
  /** The fields that the permission applies to */
  fields: string[];
  /** The conditions that must be met for the permission to apply */
  conditions: Array<Condition<T, PathsToStringProps<T>>>;
  /** Whether this is an allow or deny rule */
  type: "allow" | "deny";
};

/**
 * Parameters for checking a permission
 * @template T The type of data being checked
 */
export type PermissionCheck<T> = {
  /** The subject requesting access */
  subject: any;
  /** The action being performed */
  action: string;
  /** The object being accessed */
  object: string;
  /** The field being accessed */
  field: string;
  /** The data being evaluated */
  data: DeepPartial<T>;
};

// Serialization types
/**
 * Data transfer object for permission conditions
 */
export interface PermissionConditionDTO {
  /** The field to check */
  field: string;
  /** The operator to use for comparison */
  operator: string;
  /** The value to compare against */
  value: unknown;
}

/**
 * Data transfer object for permission rules
 */
export interface PermissionRuleDTO {
  /** Whether this is an allow or deny rule */
  effect: "allow" | "deny";
  /** The subject the rule applies to */
  subject: unknown;
  /** The action being controlled */
  action: string;
  /** The object being accessed */
  object: string;
  /** The fields this rule applies to */
  fields: string[];
  /** Optional conditions that must be met */
  conditions?: PermissionConditionDTO[];
}

export interface PermissionsDTO {
  version: 1;
  rules: PermissionRuleDTO[];
}

/**
 * Error thrown when permission validation fails
 */
export class PermissionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermissionValidationError";
  }
}
