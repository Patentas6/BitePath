import convert from 'convert-units';

export interface ConvertedIngredient {
  quantity: number;
  unit: string;
  originalUnit: string; // Keep track of the original unit for logic if needed
}

// Helper to find the best metric unit (e.g., ml to L, g to kg)
const getBestMetricUnit = (value: number, baseUnit: 'ml' | 'g'): { value: number, unit: string } => {
  if (baseUnit === 'ml') {
    return value >= 1000 ? { value: value / 1000, unit: 'L' } : { value, unit: 'ml' };
  }
  if (baseUnit === 'g') {
    return value >= 1000 ? { value: value / 1000, unit: 'kg' } : { value, unit: 'g' };
  }
  // Should not be reached if baseUnit is 'ml' or 'g'
  return { value, unit: baseUnit };
};

export const convertToPreferredSystem = (
  quantity: number,
  unit: string,
  targetSystem: 'imperial' | 'metric' // For now, 'metric' is the main target for conversion
): ConvertedIngredient | null => {
  
  // If the target is imperial, and we assume units are stored in a way that's already imperial-like,
  // or they are units like 'piece' that don't convert, return original.
  if (targetSystem === 'imperial') {
    return { quantity, unit, originalUnit: unit };
  }

  // Target is Metric
  try {
    // Normalize common abbreviations that convert-units might not recognize directly or has specific versions for
    let normalizedUnit = unit.toLowerCase();
    if (normalizedUnit === 'fl oz' || normalizedUnit === 'fluid oz') normalizedUnit = 'fl-oz';
    if (normalizedUnit === 'oz' && (unit.toLowerCase().includes('ounce'))) normalizedUnit = 'oz'; // Assuming weight oz if just 'oz'
    // 'cup' to 'cup', 'tsp' to 'tsp', 'tbsp' to 'tbsp', 'lb' to 'lb' are usually fine.
    
    const possibilities = convert().from(normalizedUnit).possibilities();
    let metricBaseTarget: 'ml' | 'g' | null = null;

    if (possibilities.includes('ml') || possibilities.includes('l')) metricBaseTarget = 'ml';
    else if (possibilities.includes('g') || possibilities.includes('kg')) metricBaseTarget = 'g';

    if (metricBaseTarget) {
      const valueInBaseMetric = convert(quantity).from(normalizedUnit).to(metricBaseTarget);
      const bestFit = getBestMetricUnit(valueInBaseMetric, metricBaseTarget);
      // Round to 1 decimal place, or 0 if it's a whole number after rounding
      const finalQuantity = parseFloat(bestFit.value.toFixed(1));
      const roundedQuantity = (finalQuantity % 1 === 0) ? Math.round(finalQuantity) : finalQuantity;

      return { quantity: roundedQuantity, unit: bestFit.unit, originalUnit: unit };
    }
    
    // If no direct path to 'ml'/'l' or 'g'/'kg', return original
    return { quantity, unit, originalUnit: unit };
  } catch (e) {
    // If 'convert-units' throws an error (e.g., unknown unit), return original
    // console.warn(`Conversion failed for ${quantity} ${unit}: ${(e as Error).message}`);
    return { quantity, unit, originalUnit: unit };
  }
};