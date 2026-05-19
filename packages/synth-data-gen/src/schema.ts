import { Type, type Schema } from "@google/genai";
import type { ColumnSpec } from "./config.js";

export function buildRowSchema(columns: Record<string, ColumnSpec>): Schema {
  const properties: Record<string, Schema> = {};
  const required: string[] = [];

  for (const [name, spec] of Object.entries(columns)) {
    const prop: Schema = {
      type: spec.type,
      description: spec.description,
    };
    if (spec.enum) prop.enum = spec.enum;
    if (spec.nullable) prop.nullable = spec.nullable;
    if (spec.items) prop.items = spec.items;
    properties[name] = prop;
    if (!spec.nullable) required.push(name);
  }

  return {
    type: Type.OBJECT,
    properties,
    required,
    propertyOrdering: Object.keys(columns),
  };
}

export function buildBatchSchema(columns: Record<string, ColumnSpec>): Schema {
  return {
    type: Type.ARRAY,
    items: buildRowSchema(columns),
  };
}
