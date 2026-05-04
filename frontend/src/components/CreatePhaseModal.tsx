import { useState } from 'react';
import { PHASE_TYPE_DESCRIPTIONS } from '../types/phases';
import type { CreatePhaseRequest } from '../types/phases';
import { Button, Select, Input, DateTimeInput } from './ui';
import { Modal } from './Modal';
import { CommentEditor } from './CommentEditor';
import { localDateTimeToUTC } from '../utils/timezone';

interface CreatePhaseModalProps {
  onClose: () => void;
  onSubmit: (data: CreatePhaseRequest) => void;
  isSubmitting: boolean;
}

export function CreatePhaseModal({ onClose, onSubmit, isSubmitting }: CreatePhaseModalProps) {
  const [formData, setFormData] = useState<CreatePhaseRequest>({
    phase_type: 'common_room',
    deadline: undefined
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      start_time: formData.start_time ? localDateTimeToUTC(formData.start_time) : undefined,
      deadline: formData.deadline ? localDateTimeToUTC(formData.deadline) : undefined
    });
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="Create New Phase">
      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
            <div>
              <Select
                id="phase-type"
                label="Phase Type"
                value={formData.phase_type}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  phase_type: e.target.value as CreatePhaseRequest['phase_type']
                }))}
                required
                helperText={PHASE_TYPE_DESCRIPTIONS[formData.phase_type]}
              >
                <option value="common_room">Common Room</option>
                <option value="action">Action Phase</option>
              </Select>
            </div>

            <div>
              <Input
                id="phase-title"
                label="Title (Optional)"
                type="text"
                value={formData.title || ''}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  title: e.target.value || undefined
                }))}
                placeholder="e.g., 'The Gathering Storm'"
                helperText="Give this phase a custom name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-content-primary mb-1">Description (Optional)</label>
              <CommentEditor
                value={formData.description || ''}
                onChange={(value) => setFormData(prev => ({
                  ...prev,
                  description: value || undefined
                }))}
                placeholder="Describe what happens in this phase. Supports markdown."
                rows={3}
                maxLength={2000}
                showCharacterCount
                textareaTestId="phase-description"
              />
              <p className="mt-1 text-xs text-content-tertiary">Supports markdown. Shown to players during action submission.</p>
            </div>

            <div>
              <DateTimeInput
                id="phase-start-time"
                label="Auto-activate at (Optional)"
                value={formData.start_time || ''}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  start_time: e.target.value || undefined
                }))}
                helperText="Phase will activate automatically at this time. Leave blank to activate manually."
              />
            </div>

            <div>
              <DateTimeInput
                id="phase-deadline"
                label="Deadline (Optional)"
                value={formData.deadline || ''}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  deadline: e.target.value || undefined
                }))}
                helperText="Set a deadline to create urgency for this phase"
              />
            </div>
        </div>

        <div className="flex justify-end space-x-3 mt-6">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Creating...' : 'Create Phase'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
