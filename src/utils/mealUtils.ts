export const parseFirstNumber = (str: string | null | undefined): number | null => {
  if (!str) return null;
  const match = str.match(/\d+(\.\d+)?/); // Matches integers or decimals
  return match ? parseFloat(match[0]) : null;
};

export const calculateCaloriesPerServing = (
  totalCaloriesStr: string | null | undefined,
  servingsStr: string | null | undefined
): number | null => {
  const totalCalories = parseFirstNumber(totalCaloriesStr);
  const servings = parseFirstNumber(servingsStr);

  if (totalCalories !== null && servings !== null && servings > 0) {
    return Math.round(totalCalories / servings);
  }
  return null;
};