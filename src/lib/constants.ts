export const MEAL_TAG_OPTIONS = ["Breakfast", "Lunch", "Dinner"] as const;
export type MealTag = typeof MEAL_TAG_OPTIONS[number];