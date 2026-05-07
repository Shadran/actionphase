# ADR-003: Authentication Strategy

## Status
Accepted

## Context
ActionPhase requires secure user authentication that supports:
- Stateless API design for scalability
- Secure session management to prevent unauthorized access
- Token refresh without requiring re-login
- Cross-device session management
- Logout functionality that truly invalidates sessions
- Protection against common authentication attacks

The solution must balance security, user experience, and implementation complexity.

## Decision
We implemented a **JWT + Refresh Token Strategy** with server-side session management:

**Primary Authentication**: JWT Access Tokens
- Short-lived JWT tokens (15 minutes) for API access
- Contains only `sub` (username), `exp`, `iat`, `jti` — user ID intentionally excluded
- Stateless verification for API performance
- Automatic refresh via axios interceptors

**Session Management**: Database-stored refresh tokens
- Long-lived refresh tokens (7 days) stored in database
- Unique session tracking with device identification
- Secure logout with token invalidation
- Session management for multiple devices

**Security Features**:
- bcrypt password hashing with appropriate cost
- Secure HTTP-only cookie option for refresh tokens (future)
- CSRF protection through token validation
- Rate limiting on authentication endpoints

## Alternatives Considered

### 1. Session-Based Authentication
**Approach**: Traditional server-side sessions with cookies.

**Pros**:
- Simple to implement and understand
- Easy session invalidation
- Lower client-side complexity
- Automatic CSRF protection with SameSite cookies

**Cons**:
- Stateful server design complicates scaling
- Session storage requirements grow with users
- CORS complexity with cookies
- Requires sticky sessions in load-balanced environments

### 2. JWT-Only Strategy
**Approach**: Long-lived JWT tokens without refresh mechanism.

**Pros**:
- Completely stateless server design
- Simple implementation
- Good performance
- Easy to scale horizontally

**Cons**:
- Cannot revoke tokens before expiration
- Security risk with long-lived tokens
- No session management capabilities
- Difficult to handle compromised tokens

### 3. OAuth2 with External Provider
**Approach**: Delegate authentication to Google, GitHub, Discord, etc.

**Pros**:
- No password storage or management
- Leverages secure, tested implementations
- User convenience with existing accounts
- Reduced authentication attack surface

**Cons**:
- Dependency on external services
- Limited customization of user experience
- Privacy concerns with data sharing
- Potential vendor lock-in

## Consequences

### Positive Consequences

**Security Benefits**:
- Short-lived access tokens limit exposure window
- Server-side refresh token storage allows revocation
- Session tracking enables multi-device management
- bcrypt password hashing protects against breaches

**User Experience**:
- Seamless token refresh without user interaction
- Cross-device session management
- Proper logout functionality
- No frequent re-authentication required

**Scalability**:
- Stateless API calls with JWT validation
- Database sessions scale with connection pooling
- Horizontal scaling without session affinity
- Efficient caching of user claims

**Development Benefits**:
- Clear separation between access and refresh flows
- Testable authentication components
- Integration with existing HTTP middleware
- Standard JWT libraries and tooling

### Negative Consequences

**Implementation Complexity**:
- Two-token system requires careful coordination
- Frontend must handle token refresh logic
- Database session management adds state
- Error handling for various token scenarios

**Security Considerations**:
- JWT payload visible to clients (no sensitive data)
- Refresh token compromise requires detection
- Token timing windows require careful design
- Rate limiting needed to prevent brute force

**Performance Impact**:
- Database queries for refresh token validation
- Additional storage for session data
- Network overhead for token refresh requests
- JWT parsing and validation on each request

### Risk Mitigation Strategies

**Token Security**:
- Use strong, random secrets for JWT signing
- Implement secure token storage in frontend
- Add correlation IDs for request tracking
- Monitor for unusual authentication patterns

**Session Management**:
- Implement session cleanup for expired tokens
- Add device fingerprinting for security
- Provide user interface for session management
- Log authentication events for audit trails

**Frontend Security**:
- Store tokens in memory where possible
- Implement automatic logout on token expiration
- Handle network errors gracefully during refresh
- Validate JWT structure and claims

## Implementation Details

### JWT Token Structure
```json
{
  "sub": "username",  // Username (not user-123)
  "exp": 1625097600,
  "iat": 1625096700,
  "jti": "token-uuid"
}
```

**Security Note**: User ID is intentionally **NOT included** in JWT payload to prevent
client-side manipulation. The user ID is fetched server-side after token validation
via the `/api/v1/auth/me` endpoint.

This approach provides defense-in-depth:
- JWT cannot be tampered to change user identity
- User data is always authoritative from server
- Eliminates client-side JWT decoding security risks

### Database Session Schema
```sql
CREATE TABLE sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    refresh_token VARCHAR(255) UNIQUE NOT NULL,
    device_id VARCHAR(255),
    user_agent TEXT,
    ip_address INET,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_refresh_token ON sessions(refresh_token);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
```

### Authentication Flow
1. **Login**: Validate credentials → Create session → Return JWT + refresh token
2. **API Access**: Include JWT in Authorization header → Validate → Process request
3. **Token Refresh**: Submit refresh token → Validate session → Return new JWT
4. **Logout**: Invalidate refresh token → Delete session → Clear client tokens

### Frontend Integration
```typescript
// Axios interceptors for automatic token management
axios.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      const newToken = await refreshAccessToken();
      if (newToken) {
        error.config.headers.Authorization = `Bearer ${newToken}`;
        return axios(error.config);
      } else {
        redirectToLogin();
      }
    }
    return Promise.reject(error);
  }
);
```

### Security Headers and Middleware
```go
// JWT validation middleware
func JWTAuthenticator(tokenAuth *jwtauth.JWTAuth) func(http.Handler) http.Handler {
    return jwtauth.Authenticator(tokenAuth)
}

// Rate limiting for auth endpoints
func AuthRateLimit() func(http.Handler) http.Handler {
    return middleware.RateLimit(5, time.Minute) // 5 requests per minute
}
```

## Future Considerations

### Planned Enhancements
- **HTTP-Only Cookies**: Move refresh tokens to secure cookies
- **Multi-Factor Authentication**: Add TOTP/SMS verification
- **Social Login**: Integration with OAuth2 providers
- **Passwordless Authentication**: Magic link or WebAuthn support

### Security Hardening
- **Device Fingerprinting**: Enhanced session tracking
- **Anomaly Detection**: Unusual login pattern detection
- **Token Binding**: Bind tokens to specific network characteristics
- **Audit Logging**: Comprehensive authentication event logging

## References
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [Go JWT Auth Library](https://github.com/go-chi/jwtauth)
- [bcrypt Documentation](https://pkg.go.dev/golang.org/x/crypto/bcrypt)
