export const IMAGE_GENERATION_LIMIT_PER_MONTH = 10;
export const RECIPE_GENERATION_LIMIT_PER_MONTH = 5;

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
] as const;

export type Unit = typeof UNITS[number];

export const MEAL_TAG_OPTIONS = [
  "Breakfast", "Lunch", "Dinner", "Snack",
  "Vegetarian", "Vegan", "Gluten-Free", "Dairy-Free",
  "Quick & Easy", "Healthy", "Comfort Food", "High Protein",
  "Low Carb", "Dessert", "Appetizer", "Side Dish",
  "Soup", "Salad", "Main Course", "Beverage",
  "Italian", "Mexican", "Asian", "Indian", "American"
] as const;

export type MealTagOption = typeof MEAL_TAG_OPTIONS[number];

export const PLANNING_MEAL_TYPES = [
  "Breakfast",
  "Lunch",
  "Dinner",
  "Snack"
] as const;

export type PlanningMealType = typeof PLANNING_MEAL_TYPES[number];