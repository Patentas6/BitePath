"use client";

import React from 'react';
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Trash2 } from 'lucide-react';
// CRITICAL: Ensure this import is exactly as follows, pointing to the constants file.
import { UNITS, Unit } from '@/lib/constants'; 

interface IngredientInputProps {
  index: number;
  ingredient: { name: string; quantity: string; unit: Unit };
  onChange: (index: number, field: string, value: string | Unit) => void;
  onRemove: (index: number) => void;
}

const IngredientInput: React.FC<IngredientInputProps> = ({ index, ingredient, onChange, onRemove }) => {
  return (
    <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-end mb-3 p-3 border rounded-md">
      <div className="flex-grow w-full sm:w-auto">
        <label htmlFor={`ingredient-name-${index}`} className="block text-sm font-medium text-gray-700 mb-1">Name</label>
        <Input
          id={`ingredient-name-${index}`}
          type="text"
          placeholder="e.g., Flour"
          value={ingredient.name}
          onChange={(e) => onChange(index, 'name', e.target.value)}
          className="w-full"
        />
      </div>
      <div className="flex-grow w-full sm:w-auto">
        <label htmlFor={`ingredient-quantity-${index}`} className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
        <Input
          id={`ingredient-quantity-${index}`}
          type="number"
          placeholder="e.g., 2"
          value={ingredient.quantity}
          onChange={(e) => onChange(index, 'quantity', e.target.value)}
          className="w-full"
        />
      </div>
      <div className="flex-grow w-full sm:w-auto">
        <label htmlFor={`ingredient-unit-${index}`} className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
        <Select
          value={ingredient.unit}
          onValueChange={(value: Unit) => onChange(index, 'unit', value)}
        >
          <SelectTrigger id={`ingredient-unit-${index}`} className="w-full sm:w-[180px]">
            <SelectValue placeholder="Select unit" />
          </SelectTrigger>
          <SelectContent>
            {UNITS.map((unit) => (
              <SelectItem key={unit} value={unit}>
                {unit}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => onRemove(index)}
        className="mt-2 sm:mt-0 text-red-500 hover:text-red-700"
        aria-label="Remove ingredient"
      >
        <Trash2 className="h-5 w-5" />
      </Button>
    </div>
  );
};

export default IngredientInput;