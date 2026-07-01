import { useState, useEffect, useRef } from 'react';
import { Button, Input } from './ui';
import { Modal } from './Modal';
import { useAddAudienceMember } from '../hooks/usePlayerManagement';
import { apiClient } from '../lib/api';
import { logger } from '@/services/LoggingService';

interface AddAudienceMemberModalProps {
  gameId: number;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface SearchResult {
  id: number;
  username: string;
  created_at: string;
}

export function AddAudienceMemberModal({ gameId, isOpen, onClose, onSuccess }: AddAudienceMemberModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedUser, setSelectedUser] = useState<SearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const addAudienceMember = useAddAudienceMember(gameId);

  useEffect(() => {
    if (!searchQuery.trim() || selectedUser) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await apiClient.auth.searchUsers(searchQuery);
        setSearchResults(response.data.users);
        setShowDropdown(true);
      } catch (error) {
        logger.error('Failed to search users', { error, searchQuery });
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, selectedUser]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectUser = (user: SearchResult) => {
    setSelectedUser(user);
    setSearchQuery(user.username);
    setShowDropdown(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedUser) {
      return;
    }

    try {
      await addAudienceMember.mutateAsync(selectedUser.id);
      setSearchQuery('');
      setSelectedUser(null);
      onClose();
      onSuccess?.();
    } catch (error) {
      logger.error('Failed to add audience member', { error, gameId, userId: selectedUser.id, username: selectedUser.username });
    }
  };

  const handleClose = () => {
    if (!addAudienceMember.isPending) {
      setSearchQuery('');
      setSelectedUser(null);
      setSearchResults([]);
      addAudienceMember.reset();
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Add Audience Member Directly"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="p-4 rounded-lg bg-semantic-info-subtle border border-border-primary">
          <p className="text-sm text-content-primary">
            Adding an audience member directly bypasses the application process and grants them immediate audience access.
          </p>
        </div>

        <div className="relative" ref={dropdownRef}>
          <Input
            label="Search Users"
            type="text"
            placeholder="Type username to search..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSelectedUser(null);
            }}
            helperText={selectedUser ? `Selected: ${selectedUser.username}` : 'Start typing to search for users'}
            required
            disabled={addAudienceMember.isPending}
          />

          {showDropdown && searchResults.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-bg-primary border border-border-primary rounded-lg shadow-lg max-h-60 overflow-auto">
              {searchResults.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => handleSelectUser(user)}
                  className="w-full px-4 py-3 text-left hover:bg-bg-secondary transition-colors border-b border-border-primary last:border-b-0"
                >
                  <div className="font-medium text-text-heading">{user.username}</div>
                  <div className="text-sm text-text-secondary">
                    Joined {new Date(user.created_at).toLocaleDateString()}
                  </div>
                </button>
              ))}
            </div>
          )}

          {showDropdown && searchResults.length === 0 && !isSearching && searchQuery.trim() && (
            <div className="absolute z-10 w-full mt-1 bg-bg-primary border border-border-primary rounded-lg shadow-lg p-4">
              <p className="text-sm text-text-secondary">No users found matching "{searchQuery}"</p>
            </div>
          )}

          {isSearching && (
            <div className="absolute z-10 w-full mt-1 bg-bg-primary border border-border-primary rounded-lg shadow-lg p-4">
              <p className="text-sm text-text-secondary">Searching...</p>
            </div>
          )}
        </div>

        {addAudienceMember.isError && (
          <div className="p-3 rounded-lg bg-semantic-danger-subtle border border-semantic-danger">
            <p className="text-sm text-semantic-danger">
              Failed to add audience member. They may already be in the game, or the user may be invalid.
            </p>
          </div>
        )}

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            disabled={addAudienceMember.isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={addAudienceMember.isPending}
            disabled={!selectedUser || addAudienceMember.isPending}
          >
            Add Audience Member
          </Button>
        </div>
      </form>
    </Modal>
  );
}
