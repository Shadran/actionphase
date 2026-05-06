import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import CharacterAvatar from './CharacterAvatar';

const ALLOWED_COLORS = new Set([
  'red', 'green', 'blue', 'purple', 'orange', 'gold', 'gray', 'teal', 'pink',
]);

const IMAGE_URL_PATTERN = /\.(png|jpe?g|gif|webp|svg|avif|bmp)(\?.*)?$/i;

function isImageUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const { pathname } = new URL(url);
    return IMAGE_URL_PATTERN.test(pathname);
  } catch {
    return IMAGE_URL_PATTERN.test(url);
  }
}

function ImageLink({ href, children }: { href: string; children: React.ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  const [loadError, setLoadError] = useState(false);

  return (
    <span className="inline">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-interactive-primary hover:text-interactive-primary-hover underline"
      >
        {children}
      </a>
      <button
        type="button"
        onClick={() => { setExpanded(e => !e); setLoadError(false); }}
        className="inline-flex items-center justify-center ml-1 w-4 h-4 text-xs text-content-tertiary hover:text-interactive-primary transition-colors align-middle"
        title={expanded ? 'Collapse image' : 'Expand image'}
        aria-label={expanded ? 'Collapse image' : 'Expand image'}
      >
        {expanded ? '▲' : '🖼'}
      </button>
      {expanded && !loadError && (
        <span className="block mt-1">
          <img
            src={href}
            alt=""
            className="max-h-96 rounded border border-border-primary"
            style={{ maxWidth: '100%' }}
            onError={() => setLoadError(true)}
          />
        </span>
      )}
      {expanded && loadError && (
        <span className="block mt-1 text-xs text-content-tertiary italic">
          Image could not be loaded.
        </span>
      )}
    </span>
  );
}

interface MentionedCharacter {
  id: number;
  name: string;
  username?: string; // Player's username (optional for backwards compatibility)
  character_type?: string; // Type of character (optional)
  avatar_url?: string | null; // Character's avatar URL (optional, can be null)
}

interface MarkdownPreviewProps {
  content: string;
  mentionedCharacters?: MentionedCharacter[];
  className?: string;
  /**
   * Allow full width for code blocks or constrain to optimal line length (65ch) for prose.
   * Default: false (constrained for optimal readability)
   */
  fullWidth?: boolean;
}

/**
 * MarkdownPreview Component
 *
 * Renders markdown content with:
 * - GitHub-flavored markdown formatting
 * - Syntax highlighting for code blocks
 * - Character mention support (@CharacterName)
 * - XSS protection via react-markdown's built-in sanitization
 * - Secure link handling (opens in new tab)
 *
 * Supported Markdown:
 * - Bold: **text** or __text__
 * - Italic: *text* or _text_
 * - Links: [text](url)
 * - Headers: # H1, ## H2, ### H3
 * - Lists: Unordered (- item) and ordered (1. item)
 * - Code: Inline `code` and fenced blocks ```
 * - Blockquotes: > quote
 * - Horizontal Rule: ---
 */
export const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({
  content,
  mentionedCharacters = [],
  className = '',
  fullWidth = false,
}) => {
  // State for tracking hovered mention
  const [hoveredMentionId, setHoveredMentionId] = useState<number | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ top: number; left: number } | null>(null);

  // Create a custom sanitize schema that allows <mark> elements with data-mention-id
  const sanitizeSchema = React.useMemo(() => {
    return {
      ...defaultSchema,
      tagNames: [...(defaultSchema.tagNames || []), 'mark', 'span'],
      attributes: {
        ...defaultSchema.attributes,
        mark: ['dataMentionId', 'data-mention-id', 'className'],
        span: ['dataColor', 'data-color'],
      },
    };
  }, []);

  // Get the hovered character's full details
  const hoveredCharacter = React.useMemo(() => {
    if (hoveredMentionId === null) return null;
    return mentionedCharacters.find((char) => char.id === hoveredMentionId) || null;
  }, [hoveredMentionId, mentionedCharacters]);

  // Helper: split content into code and non-code segments to skip processing inside code blocks
  const splitByCodeBlocks = (text: string): Array<{ text: string; isCode: boolean }> => {
    const codeBlockRegex = /(```[\s\S]*?```|`[^`\n]+?`)/g;
    const segments: Array<{ text: string; isCode: boolean }> = [];
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        segments.push({ text: text.substring(lastIndex, match.index), isCode: false });
      }
      segments.push({ text: match[0], isCode: true });
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      segments.push({ text: text.substring(lastIndex), isCode: false });
    }

    if (segments.length === 0) {
      segments.push({ text, isCode: false });
    }

    return segments;
  };

  // Replace @CharacterName mentions with highlighted spans and [color:X]...[/color] with colored spans,
  // skipping both transformations inside code blocks (inline or fenced).
  const processedContent = React.useMemo(() => {
    // Step 1: Process character mentions
    let mentionsResult = content;
    if (mentionedCharacters.length) {
      const segments = splitByCodeBlocks(content);

      const sortedCharacters = [...mentionedCharacters].sort(
        (a, b) => b.name.length - a.name.length
      );

      mentionsResult = segments.map((segment) => {
        if (segment.isCode) return segment.text;

        let processedText = segment.text;
        const replacements: Array<{ placeholder: string; replacement: string }> = [];
        sortedCharacters.forEach(({ id, name }, index) => {
          const mentionRegex = new RegExp(`@(${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'g');
          const placeholder = `___MENTION_${index}_${id}___`;
          processedText = processedText.replace(mentionRegex, (m) => {
            replacements.push({ placeholder, replacement: `<mark data-mention-id="${id}">${m}</mark>` });
            return placeholder;
          });
        });
        replacements.forEach(({ placeholder, replacement }) => {
          processedText = processedText.replace(placeholder, replacement);
        });
        return processedText;
      }).join('');
    }

    // Step 2: Process [color:X]...[/color] syntax, skipping code blocks
    const colorRegex = /\[color:([a-z]+)\]([\s\S]*?)\[\/color\]/g;
    const hasColorSyntax = colorRegex.test(mentionsResult);
    if (!hasColorSyntax) return mentionsResult;

    const colorSegments = splitByCodeBlocks(mentionsResult);
    return colorSegments.map((segment) => {
      if (segment.isCode) return segment.text;
      return segment.text.replace(
        /\[color:([a-z]+)\]([\s\S]*?)\[\/color\]/g,
        (_match, colorName: string, innerText: string) => {
          if (ALLOWED_COLORS.has(colorName)) {
            return `<span data-color="${colorName}">${innerText}</span>`;
          }
          // Unknown color: render as literal text
          return _match;
        }
      );
    }).join('');
  }, [content, mentionedCharacters]);

  return (
    <div className={`markdown-preview prose ${fullWidth ? 'max-w-none' : 'max-w-prose'} text-content-primary dark:text-white ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeSchema]]}
        components={{
          // Custom code block renderer with syntax highlighting
          code(props) {
            const { className, children, ...rest } = props;
            const match = /language-(\w+)/.exec(className || '');
            const language = match ? match[1] : '';
            const inline = !match;

            return !inline && language ? (
              <SyntaxHighlighter
                style={vscDarkPlus as { [key: string]: React.CSSProperties }}
                language={language}
                PreTag="div"
              >
                {String(children).replace(/\n$/, '')}
              </SyntaxHighlighter>
            ) : (
              <code className={className} {...rest}>
                {children}
              </code>
            );
          },

          // Secure link handling - open in new tab with security attributes
          // Image URLs get an inline expand toggle button
          a({ children, href, ...props }) {
            if (isImageUrl(href)) {
              return <ImageLink href={href!}>{children}</ImageLink>;
            }
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-interactive-primary hover:text-interactive-primary-hover underline"
                {...props}
              >
                {children}
              </a>
            );
          },

          // Custom mark element for character mentions
          mark({ children, ...props }) {
            const mentionId = (props as Record<string, unknown>)['data-mention-id'] as number | undefined;

            const handleMouseEnter = (e: React.MouseEvent<HTMLElement>) => {
              if (mentionId) {
                const rect = e.currentTarget.getBoundingClientRect();
                setHoveredMentionId(Number(mentionId));
                setTooltipPosition({
                  top: rect.bottom + 4, // 4px below the mention (viewport-relative for fixed positioning)
                  left: rect.left,
                });
              }
            };

            const handleMouseLeave = () => {
              setHoveredMentionId(null);
              setTooltipPosition(null);
            };

            return (
              <mark
                className="bg-interactive-primary-subtle text-interactive-primary px-1 rounded font-medium cursor-pointer hover:bg-interactive-primary relative"
                data-mention-id={mentionId}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                {...props}
              >
                {children}
              </mark>
            );
          },

          // Custom span element for colored text [color:X]...[/color]
          span({ children, ...props }) {
            const dataColor = (props as Record<string, unknown>)['data-color'] as string | undefined;
            if (dataColor && ALLOWED_COLORS.has(dataColor)) {
              return <span data-color={dataColor} {...props}>{children}</span>;
            }
            return <span {...props}>{children}</span>;
          },

          // Style headers
          h1: ({ children, ...props }) => (
            <h1 className="text-2xl font-bold mt-4 mb-2 !text-content-primary" {...props}>
              {children}
            </h1>
          ),
          h2: ({ children, ...props }) => (
            <h2 className="text-xl font-bold mt-3 mb-2 !text-content-primary" {...props}>
              {children}
            </h2>
          ),
          h3: ({ children, ...props }) => (
            <h3 className="text-lg font-bold mt-2 mb-1 !text-content-primary" {...props}>
              {children}
            </h3>
          ),

          // Style blockquotes
          blockquote: ({ children, ...props }) => (
            <blockquote
              className="border-l-4 border-theme-default pl-4 py-2 my-2 italic text-content-secondary"
              {...props}
            >
              {children}
            </blockquote>
          ),

          // Style horizontal rules
          hr: ({ ...props }) => (
            <hr className="my-4 border-t-2 border-theme-default" {...props} />
          ),

          // Style lists
          ul: ({ children, ...props }) => (
            <ul className="list-disc list-inside my-2" {...props}>
              {children}
            </ul>
          ),
          ol: ({ children, ...props }) => (
            <ol className="list-decimal list-inside my-2" {...props}>
              {children}
            </ol>
          ),
          li: ({ children, ...props }) => (
            <li className="ml-4 !text-content-primary" {...props}>
              {children}
            </li>
          ),

          // Style paragraphs
          p: ({ children, ...props }) => (
            <p className="my-2 !text-content-primary" {...props}>
              {children}
            </p>
          ),

          // Style inline elements
          strong: ({ children, ...props }) => (
            <strong {...props}>
              {children}
            </strong>
          ),
          em: ({ children, ...props }) => (
            <em {...props}>
              {children}
            </em>
          ),
        } as Components}
        // react-markdown automatically sanitizes HTML to prevent XSS
        // It only allows safe markdown and doesn't execute scripts
      >
        {processedContent}
      </ReactMarkdown>

      {/* Tooltip for character mentions */}
      {hoveredCharacter && tooltipPosition && (
        <div
          className="fixed z-50 px-3 py-2 text-sm bg-gray-900 dark:bg-gray-800 border border-border-primary rounded-lg shadow-lg pointer-events-none"
          style={{
            top: `${tooltipPosition.top}px`,
            left: `${tooltipPosition.left}px`,
          }}
        >
          <div className="flex items-center gap-2">
            <CharacterAvatar
              avatarUrl={hoveredCharacter.avatar_url}
              characterName={hoveredCharacter.name}
              size="sm"
            />
            <div>
              <div className="font-semibold text-white">{hoveredCharacter.name}</div>
              {hoveredCharacter.username && (
                <div className="text-xs text-gray-300 mt-0.5">
                  Player: {hoveredCharacter.username}
                </div>
              )}
              {hoveredCharacter.character_type && (
                <div className="text-xs text-gray-400 mt-0.5 capitalize">
                  {hoveredCharacter.character_type.replace('_', ' ')}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarkdownPreview;
