import { useState } from 'react';
import { Button, Input } from '../ui';
import { CommentEditor } from '../CommentEditor';

export interface CurrencyFormData {
  type: string;
  amount: number;
  description?: string;
}

interface CurrencyFormProps {
  onSubmit: (data: CurrencyFormData) => void;
  onCancel: () => void;
  initialValues?: Partial<CurrencyFormData>;
  submitLabel?: string;
  variant?: 'modal' | 'inline';
  submitButtonTestId?: string;
}

/**
 * Shared form component for adding/editing currency entries.
 * Used in both AddCurrencyModal and CurrencyTab to ensure consistency.
 */
export const CurrencyForm: React.FC<CurrencyFormProps> = ({
  onSubmit,
  onCancel,
  initialValues,
  submitLabel = 'Add Currency',
  variant = 'modal',
  submitButtonTestId,
}) => {
  const [type, setType] = useState(initialValues?.type || '');
  const [amount, setAmount] = useState(initialValues?.amount?.toString() || '');
  const [description, setDescription] = useState(initialValues?.description || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!type.trim()) return;

    onSubmit({
      type: type.trim(),
      amount: parseFloat(amount) || 0,
      description: description.trim() || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        id="currency-type"
        label="Currency Type *"
        type="text"
        value={type}
        onChange={(e) => setType(e.target.value)}
        placeholder="e.g., Gold, Credits, XP, Reputation"
        required
      />

      <Input
        id="currency-amount"
        label="Amount"
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="0"
        min={0}
        step="any"
      />

      <div>
        <label htmlFor="currency-description" className="block text-sm font-medium text-content-primary mb-2">
          Description <span className="text-xs text-content-tertiary font-normal">(Markdown supported)</span>
        </label>
        <CommentEditor
          id="currency-description"
          value={description}
          onChange={setDescription}
          placeholder="Optional notes..."
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
