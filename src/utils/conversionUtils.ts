import convert from 'convert-units';

export interface ConvertedIngredient {
  quantity: number;
  unit: string;
  originalUnit: string; 
}

const getBestMetricUnit = (value: number, baseUnit: 'ml' | 'g'): { value: number, unit: string } => {
  if (baseUnit === 'ml') {
    return value >= 1000 ? { value: value / 1000, unit: 'L' } : { value, unit: 'ml' };
  }
  if (baseUnit === 'g') {
    return value >= 1000 ? { value: value / 1000, unit: 'kg' } : { value, unit: 'g' };
  }
  return { value, unit: baseUnit };
};

// Units to explicitly NOT convert from their common form to ml/L when target is metric
const RETAIN_AS_IS_UNITS: ReadonlyArray<string> = [
  'cup', 'cups', 
  'tsp', 'teaspoon', 'teaspoons',
  'tbsp', 'tablespoon', 'tablespoons'
];

export const convertToPreferredSystem = (
  quantity: number,
  unit: string,
  targetSystem: 'imperial' | 'metric'
): ConvertedIngredient | null => {
  
  if (targetSystem === 'imperial') {
    return { quantity, unit, originalUnit: unit };
  }

  // Target is Metric
  let normalizedUnit = unit.toLowerCase().trim();

  // Check if the unit should be retained as is
  if (RETAIN_AS_IS_UNITS.includes(normalizedUnit)) {
    return { quantity, unit, originalUnit: unit };
  }

  try {
    // Normalize other common abbreviations for convert-units
    if (normalizedUnit === 'fl oz' || normalizedUnit === 'fluid oz') normalizedUnit = 'fl-oz';
    if (normalizedUnit === 'oz' && unit.toLowerCase().includes('ounce')) normalizedUnit = 'oz'; // Distinguish from fl-oz if possible
    if (normalizedUnit === 'lb' || normalizedUnit === 'lbs') normalizedUnit = 'lb';
    
    const possibilities = convert().from(normalizedUnit).possibilities();
    let metricBaseTarget: 'g' | 'ml' | null = null;

    // Prioritize mass conversion for units like 'lb' or 'oz' (if they are mass)
    if (possibilities.includes('g') || possibilities.includes('kg')) {
      metricBaseTarget = 'g';
    } 
    // Then volume for other units, if not already handled by RETAIN_AS_IS_UNITS
    else if (possibilities.includes('ml') || possibilities.includes('l')) {
      metricBaseTarget = 'ml';
    }

    if (metricBaseTarget) {
      const valueInBaseMetric = convert(quantity).from(normalizedUnit).to(metricBaseTarget);
      const bestFit = getBestMetricUnit(valueInBaseMetric, metricBaseTarget);
      
      const finalQuantity = parseFloat(bestFit.value.toFixed(1));
      const roundedQuantity = (finalQuantity % 1 === 0) ? Math.round(finalQuantity) : finalQuantity;

      return { quantity: roundedQuantity, unit: bestFit.unit, originalUnit: unit };
    }
    
    // If no direct path to 'ml'/'l' or 'g'/'kg' (and not in RETAIN_AS_IS_UNITS), return original
    return { quantity, unit, originalUnit: unit };
  } catch (e) {
    // If 'convert-units' throws an error, return original
    // console.warn(`Conversion failed for ${quantity} ${unit}: ${(e as Error).message}`);
    return { quantity, unit, originalUnit: unit };
  }
};