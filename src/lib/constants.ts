export const IMAGE_GENERATION_LIMIT_PER_MONTH = 10; // Example value, adjust if needed
export const RECIPE_GENERATION_LIMIT_PER_MONTH = 5;  // Example value, adjust if needed

export const UNITS = [
  'g', 'kg', 'mg', 
  'oz', 'lb', 
  'ml', 'cl', 'l', 
  'tsp', 'tbsp', 
  'cup', 'pint', 'quart', 'gallon',
  'pcs', 'slices', 'cloves', 
  'pinch', 'dash', 'handful',
  'can', 'bottle', 'package',
  'cm', 'inch',
  // Add any other units you commonly use
] as const;

// You can also define a type for these units if needed elsewhere
export type Unit = typeof UNITS[number];

// Add any other constants your application might need here