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
  const rangeMatch = str.match(/^(\d+(\.\d+)?)\s*[-toTO]+\s*\d+(\.\d+)?/i);
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
  // Made this more specific to look for "serves X" or "(X)" type patterns.
  const keywordThenNumMatch = str.match(/(?:serves|\(directly serves\))\s*(\d+(\.\d+)?)(?:\s*people)?|\((\d+(\.\d+)?)\s*(?:servings?|people)?\)/i);
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
  // This is broad, so it's a last resort.
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
  const totalCalories = parseFirstNumber(totalCaloriesStr); // This should get the primary calorie number, e.g., 450 from "450-500..."
  let servings: number | null = null;

  // Try to parse servings from servingsStr first, ensuring it's not the literal string "null"
  if (servingsStr && servingsStr.trim() !== "" && servingsStr.toLowerCase() !== "null") {
    servings = extractServingsCount(servingsStr);
  }

  // Fallback: If servings is still null (because servingsStr was "null", empty, or unparseable)
  // AND totalCaloriesStr exists, try to find an explicit "(serves X)" pattern within totalCaloriesStr.
  if (servings === null && totalCaloriesStr) {
    const explicitServesMatch = totalCaloriesStr.match(/\(serves\s*(\d+(\.\d+)?)\)/i);
    if (explicitServesMatch && explicitServesMatch[1]) {
      const num = parseFloat(explicitServesMatch[1]);
      if (!isNaN(num) && num > 0) {
        servings = num;
        // console.log(`[mealUtils] Extracted servings (${servings}) from explicit pattern in calorie string: "${totalCaloriesStr}"`);
      }
    }
  }
  
  console.log(`[mealUtils] calculateCPS Input: totalStr="${totalCaloriesStr}", servStr="${servingsStr}"`);
  console.log(`[mealUtils] calculateCPS Parsed: totalNum=${totalCalories}, servNum=${servings}`);

  if (totalCalories !== null && servings !== null && servings > 0) {
    // If totalCaloriesStr contains "per serving", assume totalCalories is already per serving
    // UNLESS we successfully extracted a different serving count from an explicit "(serves X)" in totalCaloriesStr
    // OR if servingsStr provided a valid number.
    // This is tricky. The AI should NOT put "per serving" in the total field.
    // For now, we trust totalCalories is the TOTAL if servings were found.
    // If the AI is outputting "X kcal per serving" in the total field, and "serves Y" in the same field,
    // then totalCalories would be X, and servings would be Y. X/Y would be calories per serving per serving...
    // The primary fix is AI output. This client-side is best effort.

    // Let's assume totalCalories is the TOTAL for the recipe as per the prompt.
    const result = Math.round(totalCalories / servings);
    console.log(`[mealUtils] calculateCPS Result: ${result} (from ${totalCalories}/${servings})`);
    return result;
  }
  console.log(`[mealUtils] calculateCPS Result: null (condition not met for calculation)`);
  return null;
};