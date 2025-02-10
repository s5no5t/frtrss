export type Primitive = string | number | boolean | null;

/**
 * Maps resource types to their corresponding data types
 * @template T The record type mapping resource types to their data types
 */
export type ResourceTypeMap<T> = T extends Record<
  string,
  ResourceDefinition<any, any>
>
  ? T
  : never;

/**
 * Gets the data type for a specific resource type
 * @template T The record type mapping resource types to their definitions
 * @template K The resource type key
 */
export type ResourceType<
  T extends Record<string, ResourceDefinition<any, any>>,
  K extends keyof T
> = T[K] extends ResourceDefinition<infer D, any> ? D : never;

/**
 * Gets the allowed actions for a specific resource type
 * @template T The record type mapping resource types to their definitions
 * @template K The resource type key
 */
export type ResourceActions<
  T extends Record<string, ResourceDefinition<any, any>>,
  K extends keyof T
> = T[K] extends ResourceDefinition<any, infer A> ? A : never;

/**
 * Makes all properties in T optional recursively
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Extracts property keys from an object type that are strings
 * @template T The object type to extract keys from
 */
export type PropertyKey<T> = keyof T & string;

/**
 * Generates nested path strings for object properties (e.g. "user.address.street")
 * Includes both direct object properties and their nested paths
 * @template T The object type to generate paths for
 */
export type NestedPaths<T> = T extends object
  ? {
      [K in PropertyKey<T>]: T[K] extends object
        ? `${K}` | `${K}.${NestedPaths<T[K]>}`
        : `${K}`;
    }[PropertyKey<T>]
  : never;

/**
 * Generates all possible property paths for an object type
 * Includes both top-level properties and nested paths in dot notation
 * @template T The object type to generate paths for
 * @example
 * type User = {
 *   name: string;
 *   address: {
 *     street: string;
 *     city: string;
 *   };
 * };
 * // PathsToStringProps<User> = "name" | "address" | "address.street" | "address.city"
 */
export type PathsToStringProps<T> = T extends object ? NestedPaths<T> : never;

/**
 * Gets the type of a direct property access (no dots in path)
 * @template T The object type
 * @template P The property key
 * @internal
 */
type DirectPropertyType<T, P> = P extends keyof T ? T[P] : never;

/**
 * Gets the type of a nested property access (path contains dots)
 * @template T The object type
 * @template K The first key in the path
 * @template R The rest of the path
 * @internal
 */
type NestedPropertyType<
  T,
  K extends string,
  R extends string
> = K extends keyof T ? ValueAtPath<T[K], R> : never;

/**
 * Gets the type of a value at a specific path in an object type using dot notation
 * @template T The object type to traverse
 * @template P The dot-notation path to the value (e.g. "user.address.street")
 * @returns The type of the value at the given path, or never if the path is invalid
 *
 * @example
 * type User = {
 *   name: string;
 *   age: number;
 *   address: {
 *     street: string;
 *     city: string;
 *     geo: {
 *       lat: number;
 *       lng: number;
 *     };
 *   };
 *   tags: string[];
 * };
 *
 * // Simple property access
 * type Name = ValueAtPath<User, "name">; // string
 *
 * // Nested property access
 * type Street = ValueAtPath<User, "address.street">; // string
 * type Lat = ValueAtPath<User, "address.geo.lat">; // number
 *
 * // Array property access
 * type Tags = ValueAtPath<User, "tags">; // string[]
 *
 * // Invalid paths
 * type Invalid1 = ValueAtPath<User, "nonexistent">; // never
 * type Invalid2 = ValueAtPath<User, "name.invalid">; // never (can't traverse primitive)
 */
export type ValueAtPath<T, P extends string> = P extends `${infer K}.${infer R}`
  ? NestedPropertyType<T, K, R>
  : DirectPropertyType<T, P>;

export type ComparisonOperator = "eq" | "ne" | "gt" | "gte" | "lt" | "lte";
export type ArrayMembershipOperator = "in" | "nin";
export type ArrayOperator = ArrayMembershipOperator;
export type Operator = ComparisonOperator | ArrayOperator;

export type ArrayMembershipCondition<T, P extends PathsToStringProps<T>> = {
  field: P;
  operator: ArrayMembershipOperator;
  value: ValueAtPath<T, P> extends Array<infer E> ? E : never;
};

export type ValueCondition<T, P extends PathsToStringProps<T>> = {
  field: P;
  operator: ComparisonOperator;
  value: ValueAtPath<T, P> extends Array<any> ? never : ValueAtPath<T, P>;
};

export type Condition<T, P extends PathsToStringProps<T>> = ValueAtPath<
  T,
  P
> extends Array<any>
  ? ArrayMembershipCondition<T, P>
  : ValueCondition<T, P>;

/**
 * Represents a resource definition with its data type and allowed actions
 */
export type ResourceDefinition<TData, TActions extends string = string> = {
  data: TData;
  actions: TActions;
};

/**
 * Represents a permission rule that defines access control
 * @template T The record type mapping resource types to their definitions
 * @template S The type of the subject
 * @template O The type of the object (keyof T)
 */
export type Permission<
  T extends Record<string, ResourceDefinition<any, any>>,
  S,
  O extends keyof T = keyof T
> = {
  /** The subject requesting access */
  subject: S;
  /** The action being performed */
  action: T[O]["actions"];
  /** The object being accessed */
  object: O;
  /** The fields that the permission applies to */
  fields: string[];
  /** The conditions that must be met for the permission to apply */
  conditions: Array<
    Condition<ResourceType<T, O>, PathsToStringProps<ResourceType<T, O>>>
  >;
  /** Whether this is an allow or deny rule */
  type: "allow" | "deny";
};

/**
 * Parameters for checking a permission
 * @template T The record type mapping resource types to their definitions
 * @template O The type of the object (keyof T)
 */
export type PermissionCheck<
  T extends Record<string, ResourceDefinition<any, any>>,
  O extends keyof T = keyof T
> = {
  /** The subject requesting access */
  subject: any;
  /** The action being performed */
  action: ResourceActions<T, O>;
  /** The object being accessed */
  object: O;
  /** The field being accessed */
  field: string;
  /** The data being evaluated */
  data: DeepPartial<ResourceType<T, O>>;
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
