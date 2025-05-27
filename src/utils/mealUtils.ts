// Tries to find the first standalone number (integer or decimal)
export const parseFirstNumber = (str: string | null | undefined): number | null => {
  if (!str) return null;
  const match = str.match(/(\d+(\.\d+)?)/);
  return match ? parseFloat(match[1]) : null;
};

// Tries to extract serving count, looking for patterns like "(serves X)" or "X servings"
const extractServingsCount = (str: string | null | undefined): number | null => {
  if (!str) return null;
  
  // Try to match "serves X" or "X servings" or "(X)" or "X people"
  // Looks for a number possibly followed by "servings", "serving", "people" or inside parentheses
  const servingsMatch = str.match(/(?:serves\s*|for\s*|^)(\d+(\.\d+)?)(?:\s*(?:servings?|people))?|\((\d+(\.\d+)?)\)/i);
  
  if (servingsMatch) {
    // Check capturing groups: servingsMatch[1] for "serves X", servingsMatch[3] for "(X)"
    const numStr = servingsMatch[1] || servingsMatch[3];
    if (numStr) {
      const num = parseFloat(numStr);
      if (!isNaN(num) && num > 0) return num;
    }
  }
  // If no specific pattern, try parsing the whole string as a number (e.g., if it's just "2")
  const directParse = parseFloat(str);
  if (!isNaN(directParse) && directParse > 0) return directParse;

  return null;
};

export const calculateCaloriesPerServing = (
  totalCaloriesStr: string | null | undefined,
  servingsStr: string | null | undefined
): number | null => {
  const totalCalories = parseFirstNumber(totalCaloriesStr);
  
  let servings: number | null = null;
  if (servingsStr && servingsStr.trim() !== "") {
    servings = extractServingsCount(servingsStr);
  }

  // Fallback: If servingsStr was empty or didn't yield a number,
  // try to extract servings from the totalCaloriesStr
  if (servings === null && totalCaloriesStr) {
    // console.log(`[mealUtils] Servings field was empty/invalid. Trying to extract from calorie string: "${totalCaloriesStr}"`);
    servings = extractServingsCount(totalCaloriesStr);
  }

  // console.log(`[mealUtils] totalCaloriesStr: "${totalCaloriesStr}" -> Parsed Total Cal: ${totalCalories}`);
  // console.log(`[mealUtils] servingsStr: "${servingsStr}" -> Parsed Servings: ${servings}`);

  if (totalCalories !== null && servings !== null && servings > 0) {
    return Math.round(totalCalories / servings);
  }
  return null;
};