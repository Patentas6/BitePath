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

  // Pattern 1: "X servings", "X people" (number followed by keyword)
  const numThenKeywordMatch = str.match(/^(\d+(\.\d+)?)\s*(?:servings?|people)/i);
  if (numThenKeywordMatch && numThenKeywordMatch[1]) {
    const num = parseFloat(numThenKeywordMatch[1]);
    if (!isNaN(num) && num > 0) return num;
  }

  // Pattern 2: "serves X", "servings for X", "for X people", "(X servings)", "(X people)", "(X)"
  // (Keywords followed by number, or number in parentheses)
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

  if (servings === null && totalCaloriesStr) {
    servings = extractServingsCount(totalCaloriesStr);
  }
  
  // console.log(`[mealUtils] Final values - TotalCal: ${totalCalories}, Servings: ${servings}`);

  if (totalCalories !== null && servings !== null && servings > 0) {
    return Math.round(totalCalories / servings);
  }
  return null;
};