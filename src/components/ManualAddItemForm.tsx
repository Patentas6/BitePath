import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlusCircle, X } from 'lucide-react';

interface ManualAddItemFormProps {
  onAddItem: (item: { name: string; quantity: string; unit: string }) => void;
  onCancel: () => void;
}

const ManualAddItemForm: React.FC<ManualAddItemFormProps> = ({ onAddItem, onCancel }) => {
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [nameError, setNameError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setNameError('Item name is required.');
      return;
    }
    setNameError('');
    onAddItem({ name: name.trim(), quantity: quantity.trim(), unit: unit.trim() });
    setName('');
    setQuantity('');
    setUnit('');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 p-3 border rounded-md bg-muted/50 my-4">
      <h4 className="text-sm font-medium text-foreground">Add Custom Item</h4>
      <div>
        <Label htmlFor="manual-item-name" className="text-xs">Item Name (Required)</Label>
        <Input
          id="manual-item-name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (nameError && e.target.value.trim()) setNameError('');
          }}
          placeholder="e.g., Baking Soda"
          className="mt-1"
        />
        {nameError && <p className="text-xs text-red-500 mt-1">{nameError}</p>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="manual-item-quantity" className="text-xs">Quantity (Optional)</Label>
          <Input
            id="manual-item-quantity"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="e.g., 1"
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="manual-item-unit" className="text-xs">Unit (Optional)</Label>
          <Input
            id="manual-item-unit"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="e.g., box, pack"
            className="mt-1"
          />
        </div>
      </div>
      <div className="flex justify-end space-x-2 pt-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          <X className="mr-1 h-4 w-4" /> Cancel
        </Button>
        <Button type="submit" size="sm">
          <PlusCircle className="mr-1 h-4 w-4" /> Add Item
        </Button>
      </div>
    </form>
  );
};

export default ManualAddItemForm;