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

  // Pattern for ranges like "X-Y servings" or "X to Y servings" - take the first number
  const rangeMatch = str.match(/^(\d+(\.\d+)?)\s*[-toTO]+\s*\d+(\.\d+)?/i); // Made 'to' case-insensitive and added it
  if (rangeMatch && rangeMatch[1]) {
    const num = parseFloat(rangeMatch[1]);
    if (!isNaN(num) && num > 0) return num;
  }

  // Pattern 1: "X servings", "X people" (number followed by keyword)
  const numThenKeywordMatch = str.match(/^(\d+(\.\d+)?)\s*(?:servings?|people)/i);
  if (numThenKeywordMatch && numThenKeywordMatch[1]) {
    const num = parseFloat(numThenKeywordMatch[1]);
    if (!isNaN(num) && num > 0) return num;
  }

  // Pattern 2: "serves X", "servings for X", "for X people", "(X servings)", "(X people)", "(X)"
  const keywordThenNumMatch = str.match(/(?:serves|servings for|for)\s*(\d+(\.\d+)?)(?:\s*people)?|\((\d+(\.\d+)?)\s*(?:servings?|people)?\)/i);
  if (keywordThenNumMatch) {
    const numStr = keywordThenNumMatch[1] || keywordThenNumMatch[3];
    if (numStr) {
      const num = parseFloat(numStr);
      if (!isNaN(num) && num > 0) return num;
    }
  }
  
  // Pattern 3: If the string is just a number (e.g., "2", "2.5")
  if (/^\s*\d+(\.\d+)?\s*$/.test(str)) { 
    const num = parseFloat(str);
    if (!isNaN(num) && num > 0) return num;
  }
  
  // Fallback: try to parse the very first number in the string if no other pattern matched
  const fallbackMatch = str.match(/(\d+(\.\d+)?)/);
  if (fallbackMatch && fallbackMatch[1]) {
    const num = parseFloat(fallbackMatch[1]);
    if (!isNaN(num) && num > 0) return num;
  }

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

  // If servingsStr didn't yield a number, try to extract from totalCaloriesStr as a fallback
  // This is less ideal but can catch cases where servings are embedded like "500 calories (serves 2)"
  // Only do this if servings is still null AND totalCaloriesStr is present.
  if (servings === null && totalCaloriesStr) {
    const servingsFromCalorieStr = extractServingsCount(totalCaloriesStr);
    if (servingsFromCalorieStr) {
        // console.log(`[mealUtils] Extracted servings (${servingsFromCalorieStr}) from calorie string: "${totalCaloriesStr}"`);
        servings = servingsFromCalorieStr;
    }
  }
  
  // console.log(`[mealUtils] Final values - TotalCal: ${totalCalories}, Servings: ${servings}`);

  if (totalCalories !== null && servings !== null && servings > 0) {
    return Math.round(totalCalories / servings);
  }
  return null;
};