export function parseServings(servingsInput: string | number | undefined | null): number {
  const defaultServings = 2; // Default if parsing fails or no input

  if (typeof servingsInput === 'number') {
    return Number.isInteger(servingsInput) && servingsInput > 0 ? servingsInput : defaultServings;
  }

  if (typeof servingsInput === 'string') {
    const trimmedInput = servingsInput.trim().toLowerCase();

    // Case 1: Range like "X-Y servings" or "X - Y"
    const rangeMatch = trimmedInput.match(/^(\d+)\s*-\s*(\d+)/);
    if (rangeMatch && rangeMatch[2]) {
      const higherNumber = parseInt(rangeMatch[2], 10);
      return higherNumber > 0 ? higherNumber : defaultServings;
    }

    // Case 2: Single number like "X servings" or "X"
    const singleNumberMatch = trimmedInput.match(/^(\d+)/);
    if (singleNumberMatch && singleNumberMatch[1]) {
      const number = parseInt(singleNumberMatch[1], 10);
      return number > 0 ? number : defaultServings;
    }
    
    // Case 3: Specific keywords like "single"
    if (trimmedInput.includes("single")) return 1;
  }

  // Fallback to default if undefined, null, empty, or unparseable
  return defaultServings;
}