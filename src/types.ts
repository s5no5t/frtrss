import { z } from "zod";

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
export type ArrayOperator = "in";
export type Operator = ComparisonOperator | ArrayOperator;

export type Condition<T, P extends PathsToStringProps<T>> = {
  field: P;
  operator: ValueAtPath<T, P> extends Array<any>
    ? ArrayOperator
    : ComparisonOperator;
  value: ValueAtPath<T, P> extends Array<any>
    ? ValueAtPath<T, P>[number]
    : ValueAtPath<T, P>;
};

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
  operator: Operator;
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

// Zod schema for validation
export const permissionsDTOSchema = z.object({
  version: z.literal(1),
  rules: z.array(
    z.object({
      effect: z.enum(["allow", "deny"]),
      subject: z.unknown(),
      action: z.string(),
      object: z.string(),
      fields: z.array(z.string()),
      conditions: z
        .array(
          z.object({
            field: z.string(),
            operator: z.enum(["eq", "in", "gt", "gte", "lt", "lte"]),
            value: z.unknown(),
          })
        )
        .optional(),
    })
  ),
});

export class PermissionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermissionValidationError";
  }
}
