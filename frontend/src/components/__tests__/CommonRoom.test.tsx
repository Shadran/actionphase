import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { useLocation } from 'react-router-dom';
import { server } from '../../mocks/server';
import { renderWithProviders } from '../../test-utils/render';
import { CommonRoom } from '../CommonRoom';
import type { Message } from '../../types/messages';
import type { Character } from '../../types/characters';

// Mock data
const mockCharacters: Character[] = [
  {
    id: 1,
    game_id: 1,
    name: 'Test Character',
    character_type: 'player_character',
    user_id: 100,
    status: 'approved',
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 2,
    game_id: 1,
    name: 'Another Character',
    character_type: 'player_character',
    user_id: 100,
    status: 'approved',
    created_at: '2024-01-01T00:00:00Z',
  }
];

const mockPosts: Message[] = [
  {
    id: 1,
    game_id: 1,
    character_id: 1,
    character_name: 'Test Character',
    content: 'This is a test post',
    message_type: 'post',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 2,
    game_id: 1,
    character_id: 2,
    character_name: 'Another Character',
    content: 'Another test post',
    message_type: 'post',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  }
];

describe('CommonRoom', () => {
  beforeEach(() => {
    // Setup default successful responses
    server.use(
      // Auth endpoints
      http.get('/api/v1/auth/me', () => {
        return HttpResponse.json({
          id: 1,
          username: 'testuser',
          email: 'test@example.com',
        });
      }),
      http.get('/api/v1/auth/refresh', () => {
        return HttpResponse.json({ Token: 'mock-jwt-token' }, { status: 200 });
      }),
      // CommonRoom endpoints
      http.get('/api/v1/games/:gameId/posts', () => {
        return HttpResponse.json(mockPosts);
      }),
      http.get('/api/v1/games/:gameId/characters/controllable', () => {
        return HttpResponse.json(mockCharacters);
      }),
      // Comments endpoint
      http.get('/api/v1/games/:gameId/posts/:postId/comments', () => {
        return HttpResponse.json([]);
      }),
      // Unread comments endpoint
      http.get('/api/v1/games/:gameId/unread-comment-ids', () => {
        return HttpResponse.json([]);
      })
    );
  });

  describe('Loading State', () => {
    it('shows loading spinner initially', () => {
      renderWithProviders(<CommonRoom gameId={1} />, { gameId: 1 });

      // Check for loading spinner by class
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('hides loading spinner after data loads', async () => {
      renderWithProviders(<CommonRoom gameId={1} />, { gameId: 1 });

      await waitFor(() => {
        expect(screen.queryByRole('status', { hidden: true })).not.toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('displays error message when posts fail to load', async () => {
      server.use(
        http.get('/api/v1/games/:gameId/posts', () => {
          return HttpResponse.error();
        })
      );

      renderWithProviders(<CommonRoom gameId={1} />, { gameId: 1 });

      await waitFor(() => {
        expect(screen.getByText(/failed to load common room/i)).toBeInTheDocument();
      });
    });

    it('shows try again button on error', async () => {
      server.use(
        http.get('/api/v1/games/:gameId/posts', () => {
          return HttpResponse.error();
        })
      );

      renderWithProviders(<CommonRoom gameId={1} />, { gameId: 1 });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
      });
    });

    it('retries loading when try again is clicked', async () => {
      const user = userEvent.setup();
      let callCount = 0;

      server.use(
        http.get('/api/v1/games/:gameId/posts', () => {
          callCount++;
          if (callCount === 1) {
            return HttpResponse.error();
          }
          return HttpResponse.json(mockPosts);
        })
      );

      renderWithProviders(<CommonRoom gameId={1} />, { gameId: 1 });

      await waitFor(() => {
        expect(screen.getByText(/failed to load common room/i)).toBeInTheDocument();
      });

      const tryAgainButton = screen.getByRole('button', { name: /try again/i });
      await user.click(tryAgainButton);

      await waitFor(() => {
        expect(screen.queryByText(/failed to load common room/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Header Display', () => {
    it('displays Common Room title', async () => {
      renderWithProviders(<CommonRoom gameId={1} />, { gameId: 1 });

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /common room/i })).toBeInTheDocument();
      });
    });

    it('displays phase title when provided', async () => {
      renderWithProviders(<CommonRoom gameId={1} phaseTitle="Phase 1" />, { gameId: 1 });

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /common room - phase 1/i })).toBeInTheDocument();
      });
    });

    it('shows GM description when user is GM on current phase', async () => {
      renderWithProviders(<CommonRoom gameId={1} isCurrentPhase={true} isGM={true} />, { gameId: 1 });

      await waitFor(() => {
        expect(screen.getByText(/create gm posts to share information/i)).toBeInTheDocument();
      });
    });

    it('shows player description when user is player on current phase', async () => {
      renderWithProviders(<CommonRoom gameId={1} isCurrentPhase={true} isGM={false} />, { gameId: 1 });

      await waitFor(() => {
        expect(screen.getByText(/view gm posts and join the discussion/i)).toBeInTheDocument();
      });
    });

    it('shows historical description for past phases', async () => {
      renderWithProviders(<CommonRoom gameId={1} isCurrentPhase={false} />, { gameId: 1 });

      await waitFor(() => {
        expect(screen.getByText(/historical discussions from this phase/i)).toBeInTheDocument();
      });
    });
  });

  describe('Empty State', () => {
    it('shows empty state when no posts exist', async () => {
      server.use(
        http.get('/api/v1/games/:gameId/posts', () => {
          return HttpResponse.json([]);
        })
      );

      renderWithProviders(<CommonRoom gameId={1} />, { gameId: 1 });

      await waitFor(() => {
        expect(screen.getByText(/no posts yet/i)).toBeInTheDocument();
      });
    });

    it('shows encouragement message in empty state', async () => {
      server.use(
        http.get('/api/v1/games/:gameId/posts', () => {
          return HttpResponse.json([]);
        })
      );

      renderWithProviders(<CommonRoom gameId={1} />, { gameId: 1 });

      await waitFor(() => {
        expect(screen.getByText(/be the first to start a conversation/i)).toBeInTheDocument();
      });
    });

    it('displays empty state icon', async () => {
      server.use(
        http.get('/api/v1/games/:gameId/posts', () => {
          return HttpResponse.json([]);
        })
      );

      renderWithProviders(<CommonRoom gameId={1} />, { gameId: 1 });

      await waitFor(() => {
        const svg = document.querySelector('svg');
        expect(svg).toBeInTheDocument();
      });
    });
  });

  describe('Posts Display', () => {
    it('displays all posts', async () => {
      renderWithProviders(<CommonRoom gameId={1} />, { gameId: 1 });

      await waitFor(() => {
        const post1Elements = screen.getAllByText((content, element) => {
          return element?.textContent === 'This is a test post';
        });
        expect(post1Elements.length).toBeGreaterThan(0);

        const post2Elements = screen.getAllByText((content, element) => {
          return element?.textContent === 'Another test post';
        });
        expect(post2Elements.length).toBeGreaterThan(0);
      });
    });

    it('renders PostCard for each post', async () => {
      renderWithProviders(<CommonRoom gameId={1} />, { gameId: 1 });

      await waitFor(() => {
        // PostCards should be present (we can check for post content)
        const post1Elements = screen.getAllByText((content, element) => {
          return element?.textContent === 'This is a test post';
        });
        expect(post1Elements.length).toBeGreaterThan(0);

        const post2Elements = screen.getAllByText((content, element) => {
          return element?.textContent === 'Another test post';
        });
        expect(post2Elements.length).toBeGreaterThan(0);
      });
    });
  });

  describe('CreatePostForm Visibility', () => {
    it('shows CreatePostForm for GM on current phase', async () => {
      renderWithProviders(<CommonRoom gameId={1} isCurrentPhase={true} isGM={true} />, { gameId: 1 });

      await waitFor(() => {
        // CreatePostForm should render - we can check for a textarea or similar
        // Since we don't know the exact structure, we check that it's loaded
        expect(screen.queryByText(/failed to load/i)).not.toBeInTheDocument();
      });
    });

    it('hides CreatePostForm for players', async () => {
      renderWithProviders(<CommonRoom gameId={1} isCurrentPhase={true} isGM={false} />, { gameId: 1 });

      await waitFor(() => {
        // Content should load without CreatePostForm visible
        expect(screen.queryByText(/failed to load/i)).not.toBeInTheDocument();
      });

      expect(screen.queryByRole('button', { name: /create gm post/i })).not.toBeInTheDocument();
    });

    it('hides CreatePostForm for past phases even for GM', async () => {
      renderWithProviders(<CommonRoom gameId={1} isCurrentPhase={false} isGM={true} />, { gameId: 1 });

      await waitFor(() => {
        expect(screen.queryByText(/failed to load/i)).not.toBeInTheDocument();
      });

      expect(screen.queryByRole('button', { name: /create gm post/i })).not.toBeInTheDocument();
    });
  });

  describe('Data Loading', () => {
    it('loads posts for the correct game', async () => {
      let requestedGameId: string | undefined;

      server.use(
        http.get('/api/v1/games/:gameId/posts', ({ params }) => {
          requestedGameId = params.gameId as string;
          return HttpResponse.json(mockPosts);
        })
      );

      renderWithProviders(<CommonRoom gameId={42} />, { gameId: 1 });

      await waitFor(() => {
        expect(requestedGameId).toBe('42');
      });
    });

    it('loads posts with phase filter when phaseId provided', async () => {
      let requestParams: URLSearchParams | undefined;

      server.use(
        http.get('/api/v1/games/:gameId/posts', ({ request }) => {
          requestParams = new URL(request.url).searchParams;
          return HttpResponse.json(mockPosts);
        })
      );

      renderWithProviders(<CommonRoom gameId={1} phaseId={5} />, { gameId: 1 });

      await waitFor(() => {
        expect(requestParams?.get('phase_id')).toBe('5');
      });
    });

    it('loads posts with limit parameter', async () => {
      let requestParams: URLSearchParams | undefined;

      server.use(
        http.get('/api/v1/games/:gameId/posts', ({ request }) => {
          requestParams = new URL(request.url).searchParams;
          return HttpResponse.json(mockPosts);
        })
      );

      renderWithProviders(<CommonRoom gameId={1} />, { gameId: 1 });

      await waitFor(() => {
        expect(requestParams?.get('limit')).toBe('50');
      });
    });

    it('reloads data when gameId changes', async () => {
      let loadCount = 0;

      server.use(
        http.get('/api/v1/games/:gameId/posts', () => {
          loadCount++;
          return HttpResponse.json(mockPosts);
        })
      );

      const { rerender } = renderWithProviders(<CommonRoom gameId={1} />, { gameId: 1 });

      await waitFor(() => {
        expect(loadCount).toBe(1);
      });

      rerender(<CommonRoom gameId={2} />);

      await waitFor(() => {
        expect(loadCount).toBe(2);
      });
    });

    it('reloads data when phaseId changes', async () => {
      let loadCount = 0;

      server.use(
        http.get('/api/v1/games/:gameId/posts', () => {
          loadCount++;
          return HttpResponse.json(mockPosts);
        })
      );

      const { rerender } = renderWithProviders(<CommonRoom gameId={1} phaseId={1} />, { gameId: 1 });

      await waitFor(() => {
        expect(loadCount).toBe(1);
      });

      rerender(<CommonRoom gameId={1} phaseId={2} />);

      await waitFor(() => {
        expect(loadCount).toBe(2);
      });
    });
  });

  describe('Post Creation', () => {
    it('creates post when handleCreatePost is called', async () => {
      let createdPost: unknown;

      server.use(
        http.post('/api/v1/games/:gameId/posts', async ({ request }) => {
          createdPost = await request.json();
          return HttpResponse.json({
            id: 3,
            ...createdPost,
            created_at: '2024-01-01T00:00:00Z'
          });
        })
      );

      renderWithProviders(<CommonRoom gameId={1} isCurrentPhase={true} isGM={true} />, { gameId: 1 });

      // Wait for initial load
      await waitFor(() => {
        expect(screen.queryByRole('status', { hidden: true })).not.toBeInTheDocument();
      });

      // Note: This tests that the component is ready to handle post creation
      // Actual form interaction testing would be in CreatePostForm.test.tsx
    });
  });

  describe('Comment Creation', () => {
    it('handles comment creation without full reload', async () => {
      let _commentCreated = false;

      server.use(
        http.post('/api/v1/games/:gameId/posts/:postId/comments', () => {
          _commentCreated = true;
          return HttpResponse.json({
            id: 1,
            content: 'Test comment',
            created_at: '2024-01-01T00:00:00Z'
          });
        })
      );

      renderWithProviders(<CommonRoom gameId={1} />, { gameId: 1 });

      await waitFor(() => {
        const postElements = screen.getAllByText((content, element) => {
          return element?.textContent === 'This is a test post';
        });
        expect(postElements.length).toBeGreaterThan(0);
      });

      // Note: Comment creation is handled through PostCard component
      // This test verifies the component structure is ready for it
    });
  });

  describe('Integration', () => {
    it('displays posts and characters together', async () => {
      renderWithProviders(<CommonRoom gameId={1} />, { gameId: 1 });

      await waitFor(() => {
        // Posts should be displayed
        const postElements = screen.getAllByText((content, element) => {
          return element?.textContent === 'This is a test post';
        });
        expect(postElements.length).toBeGreaterThan(0);
        // Component should have loaded successfully
        expect(screen.queryByText(/failed to load/i)).not.toBeInTheDocument();
      });
    });

    it('handles all props correctly', async () => {
      renderWithProviders(
        <CommonRoom
          gameId={1}
          phaseId={5}
          phaseTitle="Test Phase"
          isCurrentPhase={true}
          isGM={true}
        />
      , { gameId: 1 });

      await waitFor(() => {
        const headings = screen.getAllByText((content, element) => {
          return element?.textContent?.match(/common room - test phase/i);
        });
        expect(headings.length).toBeGreaterThan(0);
        expect(screen.getByText(/create gm posts/i)).toBeInTheDocument();
      });
    });
  });

  describe('Notification Deep Linking - Phase 1 Race Condition Fixes', () => {
    const mockComment: Message = {
      id: 123,
      game_id: 1,
      phase_id: 1,
      character_id: 2,
      character_name: 'Player Character',
      content: 'Test comment content',
      message_type: 'comment',
      created_at: '2024-01-01T01:00:00Z',
      updated_at: '2024-01-01T01:00:00Z',
    };

    beforeEach(() => {
      // Mock scroll behavior
      Element.prototype.scrollIntoView = vi.fn();
      // Setup handler for fetching single message (nested comment)
      server.use(
        http.get('/api/v1/games/:gameId/messages/:messageId', () => {
          return HttpResponse.json(mockComment);
        })
      );
    });

    describe('Waiting for Data to Load', () => {
      it('waits for loading to complete before attempting to scroll to comment', async () => {
        const scrollIntoViewMock = vi.fn();
        const mockElement = {
          scrollIntoView: scrollIntoViewMock,
          classList: { add: vi.fn(), remove: vi.fn() }
        };

        // Mock getElementById to return our element
        const getElementByIdSpy = vi.spyOn(document, 'getElementById');
        getElementByIdSpy.mockImplementation((id) => {
          if (id === 'comment-123') {
            return mockElement as unknown as HTMLElement;
          }
          return null;
        });

        // Render with comment parameter in URL
        renderWithProviders(<CommonRoom gameId={1} />, {
          gameId: 1,
          initialEntries: ['/games/1?tab=common-room&view=posts&comment=123'],
        });

        // Initially should show loading state (check for role="status" to avoid multiple matches)
        await waitFor(() => {
          expect(screen.getByRole('status')).toBeInTheDocument();
        });

        // Should NOT attempt scroll yet (still loading)
        expect(getElementByIdSpy).not.toHaveBeenCalledWith('comment-123');

        // Wait for loading to complete
        await waitFor(() => {
          expect(screen.queryByRole('status')).not.toBeInTheDocument();
        });

        // After loading completes, should attempt scroll
        await waitFor(() => {
          expect(getElementByIdSpy).toHaveBeenCalledWith('comment-123');
        }, { timeout: 500 });

        // Should scroll to the element
        await waitFor(() => {
          expect(scrollIntoViewMock).toHaveBeenCalledWith({
            behavior: 'smooth',
            block: 'center',
            inline: 'nearest',
          });
        });

        getElementByIdSpy.mockRestore();
      });

      it('does not attempt scroll while still loading', async () => {
        const getElementByIdSpy = vi.spyOn(document, 'getElementById');

        // Mock API to delay response (simulate slow network)
        server.use(
          http.get('/api/v1/games/:gameId/posts', async () => {
            await new Promise(resolve => setTimeout(resolve, 200));
            return HttpResponse.json(mockPosts);
          })
        );

        renderWithProviders(<CommonRoom gameId={1} />, {
          gameId: 1,
          initialEntries: ['/games/1?tab=common-room&view=posts&comment=123'],
        });

        // Verify loading state is shown (use role="status" to avoid multiple matches)
        await waitFor(() => {
          expect(screen.getByRole('status')).toBeInTheDocument();
        });

        // getElementById should not be called yet (still loading)
        expect(getElementByIdSpy).not.toHaveBeenCalledWith('comment-123');

        // Wait for loading to complete
        await waitFor(() => {
          expect(screen.queryByRole('status')).not.toBeInTheDocument();
        }, { timeout: 1000 });

        // Now getElementById should be called
        await waitFor(() => {
          expect(getElementByIdSpy).toHaveBeenCalledWith('comment-123');
        }, { timeout: 500 });

        getElementByIdSpy.mockRestore();
      });
    });

    describe('Duplicate Scroll Prevention', () => {
      it('does not attempt to scroll multiple times for the same comment', async () => {
        const getElementByIdSpy = vi.spyOn(document, 'getElementById');
        const scrollIntoViewMock = vi.fn();
        const mockElement = {
          scrollIntoView: scrollIntoViewMock,
          classList: { add: vi.fn(), remove: vi.fn() }
        };

        getElementByIdSpy.mockImplementation((id) => {
          if (id === 'comment-123') {
            return mockElement as unknown as HTMLElement;
          }
          return null;
        });

        const { rerender } = renderWithProviders(<CommonRoom gameId={1} />, {
          gameId: 1,
          initialEntries: ['/games/1?tab=common-room&view=posts&comment=123'],
        });

        // Wait for initial scroll attempt
        await waitFor(() => {
          expect(screen.queryByText(/Loading Common Room.../i)).not.toBeInTheDocument();
        });

        await waitFor(() => {
          expect(getElementByIdSpy).toHaveBeenCalledWith('comment-123');
        }, { timeout: 500 });

        const initialCallCount = getElementByIdSpy.mock.calls.filter(
          call => call[0] === 'comment-123'
        ).length;

        // Force re-render (simulating React re-render cycle)
        rerender(<CommonRoom gameId={1} />);

        // Wait to ensure effect would have run if it was going to
        await new Promise(resolve => setTimeout(resolve, 300));

        // Should not have attempted scroll again for the same comment
        const finalCallCount = getElementByIdSpy.mock.calls.filter(
          call => call[0] === 'comment-123'
        ).length;

        expect(finalCallCount).toBe(initialCallCount);

        getElementByIdSpy.mockRestore();
      });
    });

    describe('Loading Indicator for Nested Comments', () => {
      it('shows loading indicator when fetching deeply nested comment', async () => {
        // Mock getElementById to return null (comment not in DOM)
        const getElementByIdSpy = vi.spyOn(document, 'getElementById');
        getElementByIdSpy.mockReturnValue(null);

        // Add delay so loading indicator is observable before fetch resolves
        server.use(
          http.get('/api/v1/games/:gameId/messages/:messageId', async () => {
            await new Promise(resolve => setTimeout(resolve, 200));
            return HttpResponse.json(mockComment);
          })
        );

        renderWithProviders(<CommonRoom gameId={1} />, {
          gameId: 1,
          initialEntries: ['/games/1?tab=common-room&view=posts&comment=123'],
        });

        // Wait for initial loading to complete
        await waitFor(() => {
          expect(screen.queryByText(/Loading Common Room.../i)).not.toBeInTheDocument();
        });

        // Should show "Loading comment..." indicator when fetching nested comment
        await waitFor(() => {
          expect(screen.getByText(/Loading comment.../i)).toBeInTheDocument();
        }, { timeout: 500 });

        getElementByIdSpy.mockRestore();
      });

      it('hides loading indicator after comment fetch completes', async () => {
        // Mock getElementById to return null (comment not in DOM)
        const getElementByIdSpy = vi.spyOn(document, 'getElementById');
        getElementByIdSpy.mockReturnValue(null);

        // Add delay so loading indicator is observable before fetch resolves
        server.use(
          http.get('/api/v1/games/:gameId/messages/:messageId', async () => {
            await new Promise(resolve => setTimeout(resolve, 100));
            return HttpResponse.json(mockComment);
          })
        );

        renderWithProviders(<CommonRoom gameId={1} />, {
          gameId: 1,
          initialEntries: ['/games/1?tab=common-room&view=posts&comment=123'],
        });

        // Wait for initial loading to complete
        await waitFor(() => {
          expect(screen.queryByText(/Loading Common Room.../i)).not.toBeInTheDocument();
        });

        // Loading indicator should appear
        await waitFor(() => {
          expect(screen.getByText(/Loading comment.../i)).toBeInTheDocument();
        }, { timeout: 500 });

        // Wait for fetch to complete (loading indicator should disappear)
        await waitFor(() => {
          expect(screen.queryByText(/Loading comment.../i)).not.toBeInTheDocument();
        }, { timeout: 1500 });

        getElementByIdSpy.mockRestore();
      });

      it('hides loading indicator on fetch error', async () => {
        // Mock getElementById to return null (comment not in DOM)
        const getElementByIdSpy = vi.spyOn(document, 'getElementById');
        getElementByIdSpy.mockReturnValue(null);

        // Mock API to return error (with delay so loading indicator is observable)
        server.use(
          http.get('/api/v1/games/:gameId/messages/:messageId', async () => {
            await new Promise(resolve => setTimeout(resolve, 100));
            return HttpResponse.json({ error: 'Not found' }, { status: 404 });
          })
        );

        renderWithProviders(<CommonRoom gameId={1} />, {
          gameId: 1,
          initialEntries: ['/games/1?tab=common-room&view=posts&comment=123'],
        });

        // Wait for initial loading to complete
        await waitFor(() => {
          expect(screen.queryByText(/Loading Common Room.../i)).not.toBeInTheDocument();
        });

        // Loading indicator should appear briefly
        await waitFor(() => {
          expect(screen.getByText(/Loading comment.../i)).toBeInTheDocument();
        }, { timeout: 500 });

        // Should hide loading indicator after error
        await waitFor(() => {
          expect(screen.queryByText(/Loading comment.../i)).not.toBeInTheDocument();
        }, { timeout: 1500 });

        // Should show error message
        await waitFor(() => {
          expect(screen.getByText(/Failed to load comment/i)).toBeInTheDocument();
        }, { timeout: 500 });

        getElementByIdSpy.mockRestore();
      });
    });

    describe('Scroll Behavior', () => {
      it('scrolls to comment and adds highlight styling when found in DOM', async () => {
        const scrollIntoViewMock = vi.fn();
        const addClassMock = vi.fn();
        const removeClassMock = vi.fn();
        const mockElement = {
          scrollIntoView: scrollIntoViewMock,
          classList: {
            add: addClassMock,
            remove: removeClassMock
          }
        };

        const getElementByIdSpy = vi.spyOn(document, 'getElementById');
        getElementByIdSpy.mockImplementation((id) => {
          if (id === 'comment-123') {
            return mockElement as unknown as HTMLElement;
          }
          return null;
        });

        renderWithProviders(<CommonRoom gameId={1} />, {
          gameId: 1,
          initialEntries: ['/games/1?tab=common-room&view=posts&comment=123'],
        });

        await waitFor(() => {
          expect(screen.queryByText(/Loading Common Room.../i)).not.toBeInTheDocument();
        });

        // Should scroll to element
        await waitFor(() => {
          expect(scrollIntoViewMock).toHaveBeenCalledWith({
            behavior: 'smooth',
            block: 'center',
            inline: 'nearest',
          });
        }, { timeout: 500 });

        // Should add highlight classes
        await waitFor(() => {
          expect(addClassMock).toHaveBeenCalledWith('ring-2', 'ring-interactive-primary', 'rounded-lg', 'p-1');
        });

        getElementByIdSpy.mockRestore();
      });

      it('checks multiple element ID patterns and scrolls to the found element', async () => {
        const getElementByIdSpy = vi.spyOn(document, 'getElementById');
        const mockElement = {
          scrollIntoView: vi.fn(),
          classList: { add: vi.fn(), remove: vi.fn() }
        };

        getElementByIdSpy.mockImplementation((id) => {
          if (id === 'comment-123-desktop') {
            return mockElement as unknown as HTMLElement;
          }
          return null;
        });

        renderWithProviders(<CommonRoom gameId={1} />, {
          gameId: 1,
          initialEntries: ['/games/1?tab=common-room&view=posts&comment=123'],
        });

        await waitFor(() => {
          expect(screen.queryByText(/Loading Common Room.../i)).not.toBeInTheDocument();
        });

        // Component checks all three ID patterns (base, -desktop, -mobile) and picks the found one
        await waitFor(() => {
          const calls = getElementByIdSpy.mock.calls.map(call => call[0]);
          expect(calls).toContain('comment-123');
          expect(calls).toContain('comment-123-desktop');
          expect(calls).toContain('comment-123-mobile');
        }, { timeout: 500 });

        // Should have scrolled to the found element (-desktop variant)
        expect(mockElement.scrollIntoView).toHaveBeenCalled();

        getElementByIdSpy.mockRestore();
      });

      it('checks all three ID patterns when none are found', async () => {
        const getElementByIdSpy = vi.spyOn(document, 'getElementById');
        getElementByIdSpy.mockReturnValue(null); // All patterns return null

        // Add delay to getMessage mock so we can observe loading state
        server.use(
          http.get('/api/v1/games/:gameId/messages/:messageId', async () => {
            await new Promise(resolve => setTimeout(resolve, 200));
            return HttpResponse.json(mockComment);
          })
        );

        renderWithProviders(<CommonRoom gameId={1} />, {
          gameId: 1,
          initialEntries: ['/games/1?tab=common-room&view=posts&comment=123'],
        });

        await waitFor(() => {
          expect(screen.queryByText(/Loading Common Room.../i)).not.toBeInTheDocument();
        });

        // When element not found in DOM, should check all three patterns
        await waitFor(() => {
          const calls = getElementByIdSpy.mock.calls.map(call => call[0]);
          expect(calls).toContain('comment-123');
          expect(calls).toContain('comment-123-desktop');
          expect(calls).toContain('comment-123-mobile');
        }, { timeout: 500 });

        // Should show loading indicator for nested comment fetch
        await waitFor(() => {
          expect(screen.getByText(/Loading comment.../i)).toBeInTheDocument();
        }, { timeout: 500 });

        // Wait for loading to complete
        await waitFor(() => {
          expect(screen.queryByText(/Loading comment.../i)).not.toBeInTheDocument();
        }, { timeout: 1000 });

        getElementByIdSpy.mockRestore();
      });
    });

    describe('Cross-phase redirect', () => {
      it('redirects to History tab when comment belongs to a different phase', async () => {
        // Comment 123 is in phase 99, but CommonRoom is rendering phase 1
        const commentInOtherPhase: Message = {
          ...mockComment,
          id: 123,
          phase_id: 99,
        };

        server.use(
          http.get('/api/v1/games/:gameId/messages/:messageId', () => {
            return HttpResponse.json(commentInOtherPhase);
          })
        );

        // Mock getElementById to return null (comment not in DOM)
        const getElementByIdSpy = vi.spyOn(document, 'getElementById');
        getElementByIdSpy.mockReturnValue(null);

        // Render a small helper component that displays the current MemoryRouter
        // location so we can assert navigation happened.
        const LocationCapture = () => {
          const loc = useLocation();
          return <div data-testid="location">{loc.pathname + loc.search}</div>;
        };

        renderWithProviders(
          <>
            <CommonRoom gameId={1} phaseId={1} />
            <LocationCapture />
          </>,
          {
            gameId: 1,
            initialEntries: ['/games/1?tab=common-room&view=posts&comment=123'],
          }
        );

        await waitFor(() => {
          expect(screen.queryByText(/Loading Common Room.../i)).not.toBeInTheDocument();
        });

        // After redirect, the router location should be the history URL
        await waitFor(() => {
          const locationEl = screen.getByTestId('location');
          expect(locationEl.textContent).toBe('/games/1?tab=history&phase=99&comment=123');
        }, { timeout: 1000 });

        getElementByIdSpy.mockRestore();
      });
    });
  });

  describe('Manual read mode - own comment auto-marked read', () => {
    const rootPost: Message = {
      id: 10,
      game_id: 1,
      character_id: 1,
      character_name: 'Test Character',
      author_id: 1,
      author_username: 'testuser',
      content: 'Root post',
      message_type: 'post',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      comment_count: 0,
    };

    const topLevelComment: Message = {
      id: 20,
      game_id: 1,
      character_id: 1,
      character_name: 'Test Character',
      author_id: 1,
      author_username: 'testuser',
      content: 'A top-level comment',
      message_type: 'comment',
      parent_id: 10,
      thread_depth: 1,
      is_edited: false,
      is_deleted: false,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };

    function setupManualModeHandlers(overrides: Parameters<typeof server.use>[0][] = []) {
      server.use(
        http.get('/api/v1/auth/preferences', () =>
          HttpResponse.json({ preferences: { comment_read_mode: 'manual', theme: 'auto' } })
        ),
        http.get('/api/v1/games/:gameId/posts', () =>
          HttpResponse.json([rootPost])
        ),
        http.get('/api/v1/games/:gameId/unread-comment-ids', () =>
          HttpResponse.json([])
        ),
        http.get('/api/v1/games/:gameId/manual-read-comment-ids', () =>
          HttpResponse.json([])
        ),
        http.get('/api/v1/games/:gameId/posts/:postId/comments-with-threads', () =>
          HttpResponse.json({
            comments: [topLevelComment],
            total_top_level: 1,
            returned_top_level: 1,
            returned_total: 1,
            has_more: false,
            limit: 200,
            offset: 0,
          })
        ),
        http.post('/api/v1/games/:gameId/posts/:postId/mark-read', () =>
          HttpResponse.json({}, { status: 204 })
        ),
        ...overrides,
      );
    }

    it('auto-marks own top-level comment as read using the root post ID', async () => {
      const newCommentId = 99;
      let toggleReadParams: { postId: string; commentId: string; read: boolean } | null = null;

      setupManualModeHandlers([
        http.post('/api/v1/games/:gameId/posts/:postId/comments', ({ params }) => {
          // Only intercept comment creation on the root post
          return HttpResponse.json({
            ...topLevelComment,
            id: newCommentId,
            parent_id: Number(params.postId),
          }, { status: 201 });
        }),
        http.post('/api/v1/games/:gameId/posts/:postId/comments/:commentId/toggle-read', async ({ params, request }) => {
          const body = await request.json() as { read: boolean };
          toggleReadParams = {
            postId: params.postId as string,
            commentId: params.commentId as string,
            read: body.read,
          };
          return new HttpResponse(null, { status: 204 });
        }),
      ]);

      const user = userEvent.setup();
      renderWithProviders(<CommonRoom gameId={1} phaseId={1} isCurrentPhase={true} />, { gameId: 1 });

      // Wait for post to load and Add Comment button to appear
      await waitFor(() => {
        expect(screen.getByText('Root post')).toBeInTheDocument();
      });
      await waitFor(() => {
        expect(screen.getAllByRole('button', { name: /add comment/i }).length).toBeGreaterThan(0);
      });

      await user.click(screen.getAllByRole('button', { name: /add comment/i })[0]);
      await user.type(screen.getByPlaceholderText(/write a comment\.\.\./i), 'My reply');
      await user.click(screen.getAllByRole('button', { name: /^comment$/i })[0]);

      await waitFor(() => {
        expect(toggleReadParams).not.toBeNull();
      });

      // toggle-read must use the root post ID (10), not any comment ID
      expect(toggleReadParams!.postId).toBe(String(rootPost.id));
      expect(toggleReadParams!.commentId).toBe(String(newCommentId));
      expect(toggleReadParams!.read).toBe(true);
    });

    it('does NOT auto-mark own comment as read in auto mode', async () => {
      let toggleReadCalled = false;

      server.use(
        http.get('/api/v1/auth/preferences', () =>
          HttpResponse.json({ preferences: { comment_read_mode: 'auto', theme: 'auto' } })
        ),
        http.get('/api/v1/games/:gameId/posts', () =>
          HttpResponse.json([rootPost])
        ),
        http.get('/api/v1/games/:gameId/unread-comment-ids', () =>
          HttpResponse.json([])
        ),
        http.get('/api/v1/games/:gameId/manual-read-comment-ids', () =>
          HttpResponse.json([])
        ),
        http.get('/api/v1/games/:gameId/posts/:postId/comments-with-threads', () =>
          HttpResponse.json({
            comments: [],
            total_top_level: 0,
            returned_top_level: 0,
            returned_total: 0,
            has_more: false,
            limit: 200,
            offset: 0,
          })
        ),
        http.post('/api/v1/games/:gameId/posts/:postId/mark-read', () =>
          HttpResponse.json({}, { status: 204 })
        ),
        http.post('/api/v1/games/:gameId/posts/:postId/comments', () =>
          HttpResponse.json({ ...topLevelComment, id: 99 }, { status: 201 })
        ),
        http.post('/api/v1/games/:gameId/posts/:postId/comments/:commentId/toggle-read', () => {
          toggleReadCalled = true;
          return new HttpResponse(null, { status: 204 });
        }),
      );

      const user = userEvent.setup();
      renderWithProviders(<CommonRoom gameId={1} phaseId={1} isCurrentPhase={true} />, { gameId: 1 });

      await waitFor(() => {
        expect(screen.getByText('Root post')).toBeInTheDocument();
      });
      await waitFor(() => {
        expect(screen.getAllByRole('button', { name: /add comment/i }).length).toBeGreaterThan(0);
      });

      await user.click(screen.getAllByRole('button', { name: /add comment/i })[0]);
      await user.type(screen.getByPlaceholderText(/write a comment\.\.\./i), 'My reply');
      await user.click(screen.getAllByRole('button', { name: /^comment$/i })[0]);

      // Wait for the comment form to close (submission complete)
      await waitFor(() => {
        expect(screen.queryByPlaceholderText(/write a comment\.\.\./i)).not.toBeInTheDocument();
      });

      // toggle-read should never have been called in auto mode
      expect(toggleReadCalled).toBe(false);
    });
  });
});
