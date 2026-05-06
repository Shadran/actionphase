import { useState } from 'react';
import { Button, Input } from '../ui';
import { CommentEditor } from '../CommentEditor';

export interface ItemFormData {
  name: string;
  description?: string;
  quantity: number;
  category?: string;
  value?: number;
  weight?: number;
}

interface ItemFormProps {
  onSubmit: (data: ItemFormData) => void;
  onCancel: () => void;
  initialValues?: Partial<ItemFormData>;
  submitLabel?: string;
  variant?: 'modal' | 'inline';
  submitButtonTestId?: string;
}

/**
 * Shared form component for adding/editing inventory items.
 * Used in both AddItemModal and InventoryTab to ensure consistency.
 */
export const ItemForm: React.FC<ItemFormProps> = ({
  onSubmit,
  onCancel,
  initialValues,
  submitLabel = 'Add Item',
  variant = 'modal',
  submitButtonTestId,
}) => {
  const [name, setName] = useState(initialValues?.name || '');
  const [description, setDescription] = useState(initialValues?.description || '');
  const [quantity, setQuantity] = useState(initialValues?.quantity || 1);
  const [category, setCategory] = useState(initialValues?.category || '');
  const [value, setValue] = useState<number | ''>(initialValues?.value ?? '');
  const [weight, setWeight] = useState<number | ''>(initialValues?.weight ?? '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onSubmit({
      name: name.trim(),
      description: description.trim() || undefined,
      quantity,
      category: category.trim() || undefined,
      value: value || undefined,
      weight: weight || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        id="item-name"
        label="Item Name *"
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g., Iron Sword, Health Potion"
        required
      />

      <div className="grid grid-cols-2 gap-3">
        <Input
          id="item-quantity"
          label="Quantity"
          type="number"
          value={quantity}
          onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
          min={1}
          required
        />
        <Input
          id="item-category"
          label="Category"
          type="text"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Weapon, Armor, etc."
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input
          id="item-value"
          label="Value"
          type="number"
          value={value}
          onChange={(e) => setValue(parseFloat(e.target.value) || '')}
          min={0}
          step="any"
          placeholder="0"
        />
        <Input
          id="item-weight"
          label="Weight"
          type="number"
          value={weight}
          onChange={(e) => setWeight(parseFloat(e.target.value) || '')}
          min={0}
          step="any"
          placeholder="0.0"
        />
      </div>

      <div>
        <label htmlFor="item-description" className="block text-sm font-medium text-content-primary mb-2">
          Description <span className="text-xs text-content-tertiary font-normal">(Markdown supported)</span>
        </label>
        <CommentEditor
          id="item-description"
          value={description}
          onChange={setDescription}
          placeholder="Describe this item..."
          rows={2}
          showPreviewByDefault={false}
        />
      </div>

      <div className={`flex justify-end gap-3 ${variant === 'modal' ? 'pt-4' : 'pt-2'}`}>
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          data-testid={submitButtonTestId}
        >
          {submitLabel}
        </Button>
      </div>
    </form>
  );
};
