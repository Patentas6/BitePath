"use client";

// Example: Define different types of units that might be used in recipes
export const UNITS = {
  WEIGHT_METRIC: ['g', 'kg'],
  WEIGHT_IMPERIAL: ['oz', 'lb'],
  VOLUME_METRIC: ['ml', 'l'],
  VOLUME_IMPERIAL: ['fl oz', 'cup', 'pt', 'qt', 'gal'],
  COMMON_COOKING: ['tsp', 'tbsp', 'pinch', 'dash'],
  PIECES: ['piece', 'unit', 'slice', 'clove'],
} as const;

export const UNIT_SYSTEMS = {
  METRIC: 'metric',
  IMPERIAL: 'imperial',
} as const;

export type UnitSystem = typeof UNIT_SYSTEMS[keyof typeof UNIT_SYSTEMS];

// You can add other constants here as your app grows
// For example:
// export const DEFAULT_SERVINGS = 2;
// export const MAX_INGREDIENTS = 20;