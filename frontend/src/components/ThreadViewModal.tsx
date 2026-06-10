import { useState, useEffect } from 'react';
import { ThreadedComment } from './ThreadedComment';
import type { Message } from '../types/messages';
import type { Character } from '../types/characters';
import { Button } from './ui';

interface ThreadViewModalProps {
  gameId: number;
  postId: number; // The root post ID
  comment: Message; // Pass the comment object directly instead of just ID
  characters: Character[];
  controllableCharacters: Character[];
  onClose: () => void;
  onCreateReply: (parentId: number, characterId: number, content: string, rootPostId: number) => Promise<void>;
  currentUserId?: number;
  unreadCommentIDs?: number[];
  manualReadCommentIDs?: number[];
  commentReadMode?: 'auto' | 'manual';
  onToggleRead?: (commentId: number, currentlyRead: boolean) => void;
  // New props for parent chain context (deep-link enhancement)
  parentChain?: Message[]; // Array of parent messages (oldest → target)
  hasFullThread?: boolean; // Whether we fetched all the way to root
  targetCommentId?: number; // ID of the originally requested comment to highlight
  readOnly?: boolean; // Disable all interactive features (for history view)
}

/**
 * Modal view for deeply nested comment threads
 * Shows the comment with its replies without navigating away from Common Room
 * Prevents accidental read-marking when users explore deep threads
 */
export function ThreadViewModal({
  gameId,
  postId,
  comment,
  characters,
  controllableCharacters,
  onClose,
  onCreateReply,
  currentUserId,
  unreadCommentIDs = [],
  manualReadCommentIDs = [],
  commentReadMode = 'auto',
  onToggleRead,
  parentChain,
  hasFullThread = true,
  targetCommentId,
  readOnly = false,
}: ThreadViewModalProps) {
  // State for nested modal (modal-within-modal for deeply nested threads)
  const [nestedModalComment, setNestedModalComment] = useState<Message | null>(null);

  // Determine if we're showing parent chain context or single comment
  const showingContext = parentChain && parentChain.length > 1;

  // Lock background scroll while modal is open
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = original; };
  }, []);

  // Auto-scroll to target comment when modal opens
  useEffect(() => {
    if (targetCommentId && showingContext) {
      // Wait for DOM to render, then scroll to target
      const timer = setTimeout(() => {
        // Try to find comment with various ID patterns (base, -desktop, -mobile)
        // Root comments use base ID, nested comments may have -desktop/-mobile suffix
        const baseEl = document.getElementById(`comment-${targetCommentId}`);
        const desktopEl = document.getElementById(`comment-${targetCommentId}-desktop`);
        const mobileEl = document.getElementById(`comment-${targetCommentId}-mobile`);
        // Prefer the visible element so scrollIntoView works (hidden elements don't scroll)
        const element = [baseEl, mobileEl, desktopEl].find(
          el => el && el.offsetParent !== null
        ) || baseEl || desktopEl || mobileEl;
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [targetCommentId, showingContext]);

  // Strip children property from comment to force ThreadedComment to load fresh replies
  // Comments from main view have pre-loaded children with maxDepth=5, but in thread view we want maxDepth=10
  const stripChildren = (msg: Message): Message => {
    const { _children, ...rest } = msg as Message & { _children?: unknown };
    return rest;
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div
          className="surface-base rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto overscroll-contain"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 surface-base border-b border-theme-default px-6 py-4 z-10">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-bold text-content-primary">Thread View</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                aria-label="Close thread view"
                className="text-content-tertiary hover:text-content-secondary h-auto p-0"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </Button>
            </div>

            {/* Context info */}
            {showingContext && (
              <div className="text-sm">
                <p className="text-content-secondary">
                  Showing {parentChain.length} {parentChain.length === 1 ? 'message' : 'messages'}
                  {!hasFullThread && ' (partial context)'}
                </p>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="px-6 py-6">
            {showingContext ? (
              /* Render parent chain as nested structure */
              (() => {
                // Separate parents from target
                const parents = parentChain.slice(0, -1);
                const target = parentChain[parentChain.length - 1];

                // Reconstruct parents as nested structure, with target as the deepest child
                // Use reduceRight to build from deepest to shallowest
                const reconstructedRoot = parents.reduceRight((child, parent) => {
                  return { ...parent, children: [child] };
                }, stripChildren(target));

                // Render the root parent as ThreadedComment, which cascades down to target
                // The auto-scroll effect will handle highlighting the target
                return (
                  <ThreadedComment
                    comment={reconstructedRoot}
                    gameId={gameId}
                    postId={postId}
                    characters={characters}
                    controllableCharacters={controllableCharacters}
                    onCreateReply={onCreateReply}
                    onCommentDeleted={onClose}
                    currentUserId={currentUserId}
                    depth={0}
                    maxDepth={10}
                    unreadCommentIDs={unreadCommentIDs}
                    manualReadCommentIDs={manualReadCommentIDs}
                    commentReadMode={commentReadMode}
                    onToggleRead={onToggleRead}
                    onOpenThread={(nestedComment) => setNestedModalComment(nestedComment)}
                    readOnly={readOnly}
                  />
                );
              })()
            ) : (
              /* Single comment view (original behavior) */
              <ThreadedComment
                comment={stripChildren(comment)}
                gameId={gameId}
                postId={postId}
                characters={characters}
                controllableCharacters={controllableCharacters}
                onCreateReply={onCreateReply}
                onCommentDeleted={onClose}
                currentUserId={currentUserId}
                readOnly={readOnly}
                depth={0}
                maxDepth={10}
                unreadCommentIDs={unreadCommentIDs}
                manualReadCommentIDs={manualReadCommentIDs}
                commentReadMode={commentReadMode}
                onToggleRead={onToggleRead}
                onOpenThread={(nestedComment) => setNestedModalComment(nestedComment)}
              />
            )}
          </div>
        </div>
      </div>

      {/* Nested Modal - Recursively render another ThreadViewModal if user clicks "Continue thread" in this modal */}
      {nestedModalComment && (
        <ThreadViewModal
          gameId={gameId}
          postId={postId} // Pass through the root post ID
          comment={nestedModalComment}
          characters={characters}
          controllableCharacters={controllableCharacters}
          onClose={() => setNestedModalComment(null)}
          onCreateReply={onCreateReply}
          currentUserId={currentUserId}
          unreadCommentIDs={unreadCommentIDs}
          manualReadCommentIDs={manualReadCommentIDs}
          commentReadMode={commentReadMode}
          onToggleRead={onToggleRead}
          readOnly={readOnly}
        />
      )}
    </>
  );
}
