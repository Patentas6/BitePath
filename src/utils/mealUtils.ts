// Tries to find the first standalone number (integer or decimal)
export const parseFirstNumber = (str: string | null | undefined): number | null => {
  if (!str) return null;
  // Regex to find the first sequence of digits, possibly with a decimal point
  const match = str.match(/(\d+(\.\d+)?)/);
  return match ? parseFloat(match[1]) : null;
};

// Tries to extract serving count more reliably
const extractServingsCount = (str: string | null | undefined): number | null => {
  if (!str) return null;

  // Pattern 1: "serves X", "X servings", "for X people", "(X servings)", "(X people)", "(X)"
  // Prioritize explicit mentions of servings.
  // This regex looks for keywords like "serves", "for", or numbers in parentheses possibly followed by "servings" or "people".
  const explicitServingsMatch = str.match(/(?:serves|servings for|for)\s*(\d+(\.\d+)?)(?:\s*people)?|\((\d+(\.\d+)?)\s*(?:servings?|people)?\)/i);
  if (explicitServingsMatch) {
    // If "serves X" or "for X" matched, group 1 has the number.
    // If "(X)" or "(X servings)" matched, group 3 has the number.
    const numStr = explicitServingsMatch[1] || explicitServingsMatch[3];
    if (numStr) {
      const num = parseFloat(numStr);
      if (!isNaN(num) && num > 0) return num;
    }
  }

  // Pattern 2: If the string is just a number (e.g., "2", "2.5")
  // This should only be used if the string is simple and doesn't contain other text like "kcal"
  // Useful if servingsStr is just "2".
  if (/^\s*\d+(\.\d+)?\s*$/.test(str)) { // Check if the string is basically just a number
    const num = parseFloat(str);
    if (!isNaN(num) && num > 0) return num;
  }
  
  return null;
};

export const calculateCaloriesPerServing = (
  totalCaloriesStr: string | null | undefined,
  servingsStr: string | null | undefined
): number | null => {
  // Parse total calories first. This should be less ambiguous.
  const totalCalories = parseFirstNumber(totalCaloriesStr);

  let servings: number | null = null;

  // 1. Try to get servings from the dedicated servingsStr
  if (servingsStr && servingsStr.trim() !== "") {
    servings = extractServingsCount(servingsStr);
    // console.log(`[mealUtils] Parsed from servingsStr ("${servingsStr}"): ${servings}`);
  }

  // 2. If servings not found in servingsStr, try to extract from totalCaloriesStr as a fallback
  //    This is for cases like "500 kcal (serves 2)"
  if (servings === null && totalCaloriesStr) {
    // console.log(`[mealUtils] Servings field was empty/invalid. Trying to extract from calorie string: "${totalCaloriesStr}"`);
    servings = extractServingsCount(totalCaloriesStr);
    // console.log(`[mealUtils] Parsed from totalCaloriesStr ("${totalCaloriesStr}") as fallback: ${servings}`);
  }
  
  // console.log(`[mealUtils] Final values - TotalCal: ${totalCalories}, Servings: ${servings}`);

  if (totalCalories !== null && servings !== null && servings > 0) {
    return Math.round(totalCalories / servings);
  }
  return null;
};