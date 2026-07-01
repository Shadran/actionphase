import { http, HttpResponse } from 'msw'

// MSW v2 - using path patterns to match requests regardless of protocol/host
// This works for both relative URLs (axios with empty baseURL) and absolute URLs
const handlers = [
  // Auth endpoints
  http.post('/api/v1/auth/register', () => {
    return HttpResponse.json({
      id: 1,
      username: 'testuser',
      email: 'test@example.com',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { status: 201 })
  }),

  http.post('/api/v1/auth/login', () => {
    return HttpResponse.json({
      user: {
        id: 1,
        username: 'testuser',
        email: 'test@example.com',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      Token: 'mock-jwt-token',
    })
  }),

  http.post('/api/v1/auth/logout', () => {
    return HttpResponse.json({ message: 'Logged out successfully' })
  }),

  http.get('/api/v1/auth/me', () => {
    return HttpResponse.json({
      id: 1,
      username: 'testuser',
      email: 'test@example.com',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
  }),

  http.get('/api/v1/auth/refresh', () => {
    return HttpResponse.json({
      token: 'mock-refreshed-jwt-token',
    })
  }),

  // Games endpoints
  http.get('/api/v1/games', () => {
    return HttpResponse.json([
      {
        id: 1,
        title: 'Test Game',
        description: 'A test game',
        gm_user_id: 1,
        state: 'setup',
        max_players: 4,
        is_public: true,
        is_anonymous: false,
        game_config: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ])
  }),

  http.get('/api/v1/games/:id', ({ params }) => {
    return HttpResponse.json({
      id: Number(params.id),
      title: 'Test Game',
      description: 'A test game',
      gm_user_id: 1,
      state: 'setup',
      max_players: 4,
      is_public: true,
      is_anonymous: false,
      game_config: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
  }),

  http.get('/api/v1/games/:gameId/details', ({ params }) => {
    return HttpResponse.json({
      id: Number(params.gameId),
      title: 'Test Game',
      description: 'A test game',
      gm_user_id: 1,
      gm_username: 'testgm',
      state: 'setup',
      max_players: 4,
      is_public: true,
      is_anonymous: false,
      game_config: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
  }),

  http.get('/api/v1/games/:gameId/participants', () => {
    return HttpResponse.json([
      {
        id: 1,
        user_id: 1,
        username: 'testuser',
        role: 'player',
        status: 'active',
      },
    ])
  }),

  http.post('/api/v1/games/:gameId/posts/:postId/mark-read', () => {
    return HttpResponse.json({ success: true })
  }),

  http.get('/api/v1/games/:gameId/deadlines', () => {
    return HttpResponse.json([])
  }),

  http.post('/api/v1/games', () => {
    return HttpResponse.json({
      id: 1,
      title: 'New Test Game',
      description: 'A newly created test game',
      gm_user_id: 1,
      state: 'setup',
      max_players: 4,
      is_public: true,
      is_anonymous: false,
      game_config: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { status: 201 })
  }),

  // Game Applications endpoints
  http.get('/api/v1/games/:id/applications', () => {
    return HttpResponse.json([])
  }),

  http.post('/api/v1/games/:gameId/applications', () => {
    return HttpResponse.json({
      id: 1,
      game_id: 1,
      user_id: 1,
      role: 'player',
      status: 'pending',
      character_info: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { status: 201 })
  }),

  http.patch('/api/v1/games/:gameId/applications/:applicationId', () => {
    return HttpResponse.json({
      id: 1,
      game_id: 1,
      user_id: 1,
      role: 'player',
      status: 'approved',
      character_info: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
  }),

  // Characters endpoints
  http.get('/api/v1/games/:gameId/characters', () => {
    return HttpResponse.json([])
  }),

  http.post('/api/v1/games/:gameId/characters', () => {
    return HttpResponse.json({
      id: 1,
      game_id: 1,
      user_id: 1,
      name: 'Test Character',
      character_type: 'player_character',
      character_data: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { status: 201 })
  }),

  // Phases endpoints
  http.get('/api/v1/games/:gameId/phases', () => {
    return HttpResponse.json([])
  }),

  http.get('/api/v1/games/:gameId/current-phase', () => {
    return HttpResponse.json({ phase: null })
  }),

  http.get('/api/v1/games/:gameId/phases/active', () => {
    return HttpResponse.json(null, { status: 404 })
  }),

  http.post('/api/v1/games/:gameId/phases', () => {
    return HttpResponse.json({
      id: 1,
      game_id: 1,
      phase_number: 1,
      phase_name: 'Phase 1',
      phase_type: 'action',
      is_active: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { status: 201 })
  }),

  http.post('/api/v1/phases/:phaseId/activate', () => {
    return HttpResponse.json({ success: true })
  }),

  http.patch('/api/v1/phases/:phaseId/deadline', () => {
    return HttpResponse.json({ success: true })
  }),

  http.patch('/api/v1/phases/:phaseId', () => {
    return HttpResponse.json({ success: true })
  }),

  http.get('/api/v1/games/:gameId/phases/:phaseId/results/unpublished-count', () => {
    return HttpResponse.json({ count: 0 })
  }),

  http.post('/api/v1/games/:gameId/phases/:phaseId/results/publish', () => {
    return HttpResponse.json({ success: true })
  }),

  // Messages endpoints
  http.get('/api/v1/games/:gameId/posts', () => {
    return HttpResponse.json([])
  }),

  http.post('/api/v1/games/:gameId/posts', () => {
    return HttpResponse.json({
      id: 1,
      game_id: 1,
      author_character_id: 1,
      parent_message_id: null,
      message_type: 'post',
      content: 'Test post',
      is_deleted: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { status: 201 })
  }),

  // Conversations endpoints
  http.get('/api/v1/games/:gameId/conversations', () => {
    return HttpResponse.json([])
  }),

  http.post('/api/v1/games/:gameId/conversations', () => {
    return HttpResponse.json({
      id: 1,
      game_id: 1,
      conversation_type: 'direct',
      title: 'Test Conversation',
      created_by_user_id: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { status: 201 })
  }),

  http.get('/api/v1/conversations/:conversationId/messages', () => {
    return HttpResponse.json([])
  }),

  // Notifications endpoints
  http.get('/api/v1/notifications', () => {
    return HttpResponse.json([
      {
        id: 1,
        user_id: 1,
        type: 'game_invite',
        title: 'Test Notification',
        content: 'Test notification content',
        is_read: false,
        game_id: 1,
        created_at: new Date().toISOString(),
      },
    ])
  }),

  http.get('/api/v1/notifications/unread-count', () => {
    return HttpResponse.json({ count: 5 })
  }),

  http.post('/api/v1/notifications/:notificationId/read', () => {
    return HttpResponse.json({ success: true })
  }),

  http.post('/api/v1/notifications/mark-all-read', () => {
    return HttpResponse.json({ success: true })
  }),

  // Polls endpoints
  http.get('/api/v1/games/:gameId/polls', () => {
    return HttpResponse.json([])
  }),

  http.get('/api/v1/games/:gameId/phases/:phaseId/polls', () => {
    return HttpResponse.json([])
  }),

  http.post('/api/v1/polls/:pollId/vote', () => {
    return HttpResponse.json({ success: true })
  }),

  http.get('/api/v1/polls/:pollId/results', () => {
    return HttpResponse.json({ results: [] })
  }),

  // Character endpoints
  http.get('/api/v1/games/:gameId/characters/controllable', () => {
    return HttpResponse.json([
      {
        id: 1,
        game_id: 1,
        user_id: 1,
        name: 'Test Character',
        character_type: 'player_character',
        character_data: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ])
  }),

  http.get('/api/v1/characters/:id', ({ params }) => {
    return HttpResponse.json({
      id: Number(params.id),
      game_id: 1,
      user_id: 1,
      name: 'Test Character',
      character_type: 'player_character',
      character_data: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
  }),

  http.post('/api/v1/characters/:id/approve', ({ params }) => {
    return HttpResponse.json({
      id: Number(params.id),
      game_id: 1,
      user_id: 1,
      name: 'Test Character',
      character_type: 'player_character',
      character_data: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
  }),

  http.get('/api/v1/games/:gameId/characters/inactive', () => {
    return HttpResponse.json([])
  }),

  http.get('/api/v1/games/:gameId/characters/audience-npcs', () => {
    return HttpResponse.json({ npcs: [] })
  }),

  // Actions endpoints
  http.post('/api/v1/games/:gameId/actions', () => {
    return HttpResponse.json({
      id: 1,
      game_id: 1,
      phase_id: 1,
      character_id: 1,
      content: 'Test action',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { status: 201 })
  }),

  http.get('/api/v1/games/:gameId/actions/mine', () => {
    return HttpResponse.json([])
  }),

  http.get('/api/v1/games/:gameId/actions', () => {
    return HttpResponse.json([])
  }),

  // Results endpoints
  http.get('/api/v1/games/:gameId/results/mine', () => {
    return HttpResponse.json([])
  }),

  http.get('/api/v1/games/:gameId/results', () => {
    return HttpResponse.json([])
  }),

  http.post('/api/v1/games/:gameId/results', () => {
    return HttpResponse.json({
      id: 1,
      game_id: 1,
      phase_id: 1,
      character_id: 1,
      content: 'Test result',
      is_published: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { status: 201 })
  }),

  // Comments endpoints
  http.get('/api/v1/games/:gameId/posts/:postId/comments', () => {
    return HttpResponse.json([])
  }),

  http.post('/api/v1/games/:gameId/posts/:postId/comments', () => {
    return HttpResponse.json({
      id: 1,
      game_id: 1,
      author_character_id: 1,
      parent_message_id: 1,
      message_type: 'comment',
      content: 'Test comment',
      is_deleted: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { status: 201 })
  }),

  http.get('/api/v1/games/:gameId/handouts/:handoutId/comments', () => {
    return HttpResponse.json([])
  }),

  http.get('/api/v1/games/:gameId/unread-comment-ids', () => {
    return HttpResponse.json([])
  }),

  http.get('/api/v1/games/:gameId/read-markers', () => {
    return HttpResponse.json([])
  }),

  http.get('/api/v1/games/:gameId/posts-unread-info', () => {
    return HttpResponse.json([])
  }),

  // Game application endpoints
  http.get('/api/v1/games/:gameId/application/mine', () => {
    return HttpResponse.json(null)
  }),

  http.get('/api/v1/games/:gameId/applicants', () => {
    return HttpResponse.json([])
  }),

  // Handouts endpoints
  http.get('/api/v1/games/:gameId/handouts', () => {
    return HttpResponse.json([])
  }),

  http.get('/api/v1/games/:gameId/handouts/:handoutId', ({ params }) => {
    return HttpResponse.json({
      id: Number(params.handoutId),
      game_id: Number(params.gameId),
      title: 'Test Handout',
      content: 'Test content',
      is_published: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
  }),

  http.post('/api/v1/games/:gameId/handouts', () => {
    return HttpResponse.json({
      id: 1,
      game_id: 1,
      title: 'New Handout',
      content: 'New content',
      is_published: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { status: 201 })
  }),

  // User profile endpoints
  http.get('/api/v1/users/me/profile', () => {
    return HttpResponse.json({
      id: 1,
      username: 'testuser',
      email: 'test@example.com',
      bio: '',
      avatar_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
  }),

  http.get('/api/v1/users/:username/profile', ({ params }) => {
    return HttpResponse.json({
      id: 1,
      username: params.username,
      email: 'test@example.com',
      bio: '',
      avatar_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
  }),

  // Deadlines endpoints
  http.post('/api/v1/games/:gameId/deadlines', () => {
    return HttpResponse.json({
      id: 1,
      game_id: 1,
      title: 'Test Deadline',
      deadline_date: new Date(Date.now() + 86400000).toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { status: 201 })
  }),

  http.get('/api/v1/deadlines/upcoming', () => {
    return HttpResponse.json([])
  }),

  // Health check
  http.get('/ping', () => {
    return HttpResponse.json({ message: 'pong' })
  }),

  // Stub handlers for background requests made incidentally during component tests
  http.get('/api/v1/auth/preferences', () => {
    return HttpResponse.json({ preferences: {} })
  }),

  http.post('/api/v1/games/:gameId/posts/:postId/mark-read', () => {
    return new HttpResponse(null, { status: 204 })
  }),

  http.get('/api/v1/games/:gameId/manual-read-comment-ids', () => {
    return HttpResponse.json([])
  }),

  http.get('/api/v1/characters/:id/stats', () => {
    return HttpResponse.json({ stats: {} })
  }),

  http.get('/api/v1/games/:gameId/posts/:postId/comments-with-threads', () => {
    return HttpResponse.json([])
  }),

]
