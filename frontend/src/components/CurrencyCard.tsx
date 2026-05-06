import { useState } from 'react';
import type { CurrencyEntry } from '../types/characters';
import { Button, Input } from './ui';
import { MarkdownPreview } from './MarkdownPreview';
import { CommentEditor } from './CommentEditor';

interface CurrencyCardProps {
  currency: CurrencyEntry;
  canEdit: boolean;
  onUpdate: (updates: Partial<CurrencyEntry>) => void;
  onRemove: () => void;
}

export const CurrencyCard: React.FC<CurrencyCardProps> = ({ currency, canEdit, onUpdate, onRemove }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editType, setEditType] = useState(currency.type);
  const [editAmount, setEditAmount] = useState(currency.amount);
  const [editDescription, setEditDescription] = useState(currency.description || '');

  const handleSave = () => {
    onUpdate({
      type: editType,
      amount: editAmount,
      description: editDescription || undefined
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditType(currency.type);
    setEditAmount(currency.amount);
    setEditDescription(currency.description || '');
    setIsEditing(false);
  };

  return (
    <div className="border border-theme-default rounded-lg p-4 surface-base">
      <div className="flex justify-between items-center">
        <div className="flex-1">
          {isEditing ? (
            <div className="flex items-center space-x-3">
              <Input
                type="text"
                value={editType}
                onChange={(e) => setEditType(e.target.value)}
                placeholder="Currency type..."
                className="font-medium"
              />
              <Input
                type="number"
                value={editAmount}
                onChange={(e) => setEditAmount(parseFloat(e.target.value) || 0)}
                className="w-24 text-right"
                step="any"
              />
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="font-medium text-content-primary">{currency.type}</span>
              <span className="text-lg font-semibold text-semantic-success">{currency.amount.toLocaleString()}</span>
            </div>
          )}
        </div>

        {canEdit && (
          <div className="flex space-x-1 ml-4">
            {isEditing ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSave}
                  className="p-1 text-semantic-success hover:text-semantic-success"
                >
                  ✓
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancel}
                  className="p-1 text-content-secondary hover:text-content-primary"
                >
                  ✕
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                  className="p-1 text-interactive-primary hover:text-interactive-primary-hover"
                >
                  ✎
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onRemove}
                  className="p-1 text-semantic-danger hover:text-semantic-danger"
                >
                  🗑
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {(currency.description || isEditing) && (
        <div className="mt-2">
          {isEditing ? (
            <CommentEditor
              value={editDescription}
              onChange={setEditDescription}
              placeholder="Notes about this currency... (Markdown supported)"
              rows={2}
              showPreviewByDefault={false}
            />
          ) : (
            <div className="text-sm">
              <MarkdownPreview content={currency.description || ''} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
