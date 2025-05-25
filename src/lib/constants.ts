export const MEAL_TAG_OPTIONS = [
  "Breakfast",
  "Lunch",
  "Dinner",
  "Snack",
  "High Protein",
  "Vegan",
  "Vegetarian",
  "Gluten-Free",
  "Low Carb",
  "Kid-Friendly",
  "Spicy",
  "Quick & Easy",
  "Comfort Food",
  "Healthy",
  "Soup",
  "Salad",
  "Dessert",
  "Appetizer",
  "Side Dish",
  "One-Pot",
  "Slow Cooker",
  "Instant Pot",
  "Grilling",
  "Baking",
  "Brunch", // Added Brunch
  "Afternoon Snack", // Added Afternoon Snack
] as const;

export type MealTag = typeof MEAL_TAG_OPTIONS[number];

// Define a subset of tags typically used for planning slots
export const PLANNING_MEAL_TYPES = ["Breakfast", "Brunch", "Snack", "Lunch", "Afternoon Snack", "Dinner"] as const; // Updated order and added types
export type PlanningMealType = typeof PLANNING_MEAL_TYPES[number];