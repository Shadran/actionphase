import { Input, Textarea, DateTimeInput, Checkbox, Radio } from './ui';
import { HelpTooltip } from './ui/HelpTooltip';

export interface GameFormData {
  title: string;
  description: string;
  genre: string;
  max_players: number | '';
  recruitment_deadline: string;
  start_date: string;
  end_date: string;
  is_anonymous?: boolean;
  auto_accept_audience?: boolean;
  allow_group_conversations?: boolean;
  portrait_avatars?: boolean;
}

interface GameFormFieldsProps {
  formData: GameFormData;
  onChange: (field: keyof GameFormData, value: string | number | boolean) => void;
}

export const GameFormFields = ({ formData, onChange }: GameFormFieldsProps) => {
  return (
    <>
      {/* Title */}
      <Input
        label="Game Title"
        id="title"
        type="text"
        required
        value={formData.title}
        onChange={(e) => onChange('title', e.target.value)}
        placeholder="Enter a compelling game title"
        maxLength={255}
        data-testid="game-title"
      />

      {/* Description */}
      <Textarea
        label="Description"
        id="description"
        value={formData.description}
        onChange={(e) => onChange('description', e.target.value)}
        rows={4}
        required
        placeholder="Describe your game world, setting, and what players can expect..."
        data-testid="game-description"
      />

      {/* Genre */}
      <Input
        label="Genre"
        id="genre"
        type="text"
        optional
        value={formData.genre}
        onChange={(e) => onChange('genre', e.target.value)}
        placeholder="e.g., Fantasy, Sci-Fi, Horror, Modern"
        maxLength={100}
      />

      {/* Max Players */}
      <Input
        label="Maximum Players"
        id="max_players"
        type="number"
        optional
        value={formData.max_players}
        onChange={(e) => onChange('max_players', parseInt(e.target.value) || '')}
        helperText="Leave empty for default (6 players)"
        min={1}
        max={20}
        placeholder="6"
        data-testid="max-players"
      />

      {/* Dates */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <DateTimeInput
          label="Recruitment Deadline"
          id="recruitment_deadline"
          optional
          value={formData.recruitment_deadline}
          onChange={(e) => onChange('recruitment_deadline', e.target.value)}
        />

        <DateTimeInput
          label="Start Date"
          id="start_date"
          optional
          value={formData.start_date}
          onChange={(e) => onChange('start_date', e.target.value)}
        />

        <DateTimeInput
          label="End Date"
          id="end_date"
          optional
          value={formData.end_date}
          onChange={(e) => onChange('end_date', e.target.value)}
        />
      </div>

      {/* Anonymous Mode */}
      <Checkbox
        id="is_anonymous"
        label="Anonymous Mode"
        helpText="Hides character ownership and NPC status from players. Players won't see which user controls which character, and NPCs appear indistinguishable from player characters."
        checked={formData.is_anonymous ?? false}
        onChange={(e) => onChange('is_anonymous', e.target.checked)}
      />

      {/* Auto-Accept Audience */}
      <Checkbox
        id="auto_accept_audience"
        label="Auto-Accept Audience Members"
        helpText="Audience applications are automatically approved without GM review. Audience members can read the game but cannot post or submit actions."
        checked={formData.auto_accept_audience ?? false}
        onChange={(e) => onChange('auto_accept_audience', e.target.checked)}
      />

      {/* Allow Group Conversations */}
      <Checkbox
        id="allow_group_conversations"
        label="Allow Group Conversations"
        helpText="Players can create private message threads with 3 or more participants. When disabled, private messages are limited to two people only."
        checked={formData.allow_group_conversations ?? true}
        onChange={(e) => onChange('allow_group_conversations', e.target.checked)}
      />

      {/* Avatar Style */}
      <div>
        <div className="flex items-center gap-1 mb-2">
          <span className="text-sm font-medium text-content-primary">Avatar Style</span>
          <HelpTooltip text="Circular avatars appear as small round thumbnails beside each post. Portrait avatars have a 2:3 aspect ratio and float to the left with text wrapping around them, like the old Reddit flair images." />
        </div>
        <div className="flex gap-6">
          <Radio
            name="portrait_avatars"
            value="circular"
            label="Circular"
            checked={!(formData.portrait_avatars ?? true)}
            onChange={() => onChange('portrait_avatars', false)}
          />
          <Radio
            name="portrait_avatars"
            value="portrait"
            label="Portrait"
            checked={formData.portrait_avatars ?? true}
            onChange={() => onChange('portrait_avatars', true)}
          />
        </div>
      </div>
    </>
  );
};
