import React, { useState } from 'react';

interface CharacterAvatarProps {
  avatarUrl?: string | null;
  characterName: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  shape?: 'circle' | 'portrait';
  className?: string;
}

/**
 * CharacterAvatar displays a character's avatar image with a fallback to initials
 *
 * Features:
 * - Displays avatar image if URL provided
 * - Falls back to colored circle with initials if no image or load error
 * - Supports multiple size variants (xs, sm, md, lg, xl)
 * - Consistent color per character name (deterministic hashing)
 *
 * @example
 * ```tsx
 * <CharacterAvatar
 *   avatarUrl="http://example.com/avatar.jpg"
 *   characterName="John Doe"
 *   size="md"
 * />
 * ```
 */
const CharacterAvatar: React.FC<CharacterAvatarProps> = ({
  avatarUrl,
  characterName,
  size = 'md',
  shape = 'circle',
  className = '',
}) => {
  const [imageLoadError, setImageLoadError] = useState(false);

  // Extract initials from character name
  const getInitials = (name: string): string => {
    if (!name || name.trim() === '') {
      return '?';
    }

    const words = name.trim().split(/\s+/);

    if (words.length === 1) {
      return words[0][0].toUpperCase();
    }

    // First and last word initials
    const firstInitial = words[0][0];
    const lastInitial = words[words.length - 1][0];

    return (firstInitial + lastInitial).toUpperCase();
  };

  // Generate consistent color based on character name
  const getColorClass = (name: string): string => {
    const colors = [
      'bg-avatar-1',
      'bg-avatar-2',
      'bg-avatar-3',
      'bg-avatar-4',
      'bg-avatar-5',
      'bg-avatar-6',
      'bg-avatar-7',
      'bg-avatar-8',
    ];

    // Simple hash function for consistent color selection
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }

    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };

  // Size classes mapping
  const sizeClasses = {
    xs: 'w-6 h-6 text-xs',
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-base',
    lg: 'w-12 h-12 text-lg',
    xl: 'w-16 h-16 text-xl',
  };

  const shouldShowImage = avatarUrl && !imageLoadError;

  const portraitSizeClasses = {
    xs: 'w-[32px] h-[48px]',
    sm: 'w-[48px] h-[72px]',
    md: 'w-[60px] h-[90px]',
    lg: 'w-[80px] h-[120px]',
    xl: 'w-[100px] h-[150px]',
  };

  if (shape === 'portrait') {
    return (
      <div
        data-testid="character-avatar"
        className={`${portraitSizeClasses[size]} rounded border-2 border-theme-default flex-shrink-0 ${className}`}
      >
        <div
          className={`w-full h-full rounded overflow-hidden flex items-center justify-center ${
            !shouldShowImage ? `${getColorClass(characterName)} text-white font-semibold text-2xl` : ''
          }`}
        >
          {shouldShowImage ? (
            <img
              src={avatarUrl}
              alt={characterName}
              className="w-full h-full object-cover"
              onError={() => setImageLoadError(true)}
            />
          ) : (
            <span>{getInitials(characterName)}</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="character-avatar"
      className={`${sizeClasses[size]} rounded-full overflow-hidden flex items-center justify-center ${className} ${
        !shouldShowImage ? `${getColorClass(characterName)} text-white font-semibold` : ''
      }`}
    >
      {shouldShowImage ? (
        <img
          src={avatarUrl}
          alt={characterName}
          className="w-full h-full object-cover"
          onError={() => setImageLoadError(true)}
        />
      ) : (
        <span>{getInitials(characterName)}</span>
      )}
    </div>
  );
};

export default CharacterAvatar;
