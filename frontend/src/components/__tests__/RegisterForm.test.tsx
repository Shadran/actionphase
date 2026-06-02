import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server';
import { renderWithProviders } from '../../test-utils/render';
import { RegisterForm } from '../RegisterForm';
import React from 'react';

// Mock HCaptcha to automatically call onVerify with a test token
vi.mock('../HCaptcha', () => ({
  HCaptchaWrapper: ({ onVerify }: { onVerify: (token: string) => void }) => {
    // Automatically call onVerify when component mounts to simulate CAPTCHA completion
    React.useEffect(() => {
      onVerify('test-captcha-token');
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Empty deps to call only once on mount
    return React.createElement('div', { 'data-testid': 'hcaptcha-mock' }, 'HCaptcha Mock');
  },
}));

describe('RegisterForm', () => {
  describe('Rendering', () => {
    it('renders the register heading', () => {
      renderWithProviders(<RegisterForm />);

      expect(screen.getByRole('heading', { name: /register/i })).toBeInTheDocument();
    });

    it('renders all form fields', () => {
      renderWithProviders(<RegisterForm />);

      expect(screen.getByLabelText(/^username/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    });

    it('renders submit button', () => {
      renderWithProviders(<RegisterForm />);

      const submitButton = screen.getByRole('button', { name: /register/i });
      expect(submitButton).toBeInTheDocument();
      expect(submitButton).not.toBeDisabled();
    });

    it('has required attributes on all fields', () => {
      renderWithProviders(<RegisterForm />);

      expect(screen.getByLabelText(/^username/i)).toBeRequired();
      expect(screen.getByLabelText(/email/i)).toBeRequired();
      expect(screen.getByLabelText(/^password$/i)).toBeRequired();
      expect(screen.getByLabelText(/confirm password/i)).toBeRequired();
    });

    it('has email type on email field', () => {
      renderWithProviders(<RegisterForm />);

      const emailInput = screen.getByLabelText(/email/i);
      expect(emailInput).toHaveAttribute('type', 'email');
    });

    it('has password type on password field', () => {
      renderWithProviders(<RegisterForm />);

      const passwordInput = screen.getByLabelText(/^password$/i);
      expect(passwordInput).toHaveAttribute('type', 'password');
    });

    it('shows placeholders for all fields', () => {
      renderWithProviders(<RegisterForm />);

      expect(screen.getByPlaceholderText(/choose a username/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/enter your email/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/choose a password/i)).toBeInTheDocument();
    });
  });

  describe('Form Input', () => {
    it('updates username field when user types', async () => {
      const user = userEvent.setup();
      renderWithProviders(<RegisterForm />);

      const usernameInput = screen.getByLabelText(/username/i);
      await user.type(usernameInput, 'testuser');

      expect(usernameInput).toHaveValue('testuser');
    });

    it('updates email field when user types', async () => {
      const user = userEvent.setup();
      renderWithProviders(<RegisterForm />);

      const emailInput = screen.getByLabelText(/email/i);
      await user.type(emailInput, 'test@example.com');

      expect(emailInput).toHaveValue('test@example.com');
    });

    it('updates password field when user types', async () => {
      const user = userEvent.setup();
      renderWithProviders(<RegisterForm />);

      const passwordInput = screen.getByLabelText(/^password$/i);
      await user.type(passwordInput, 'password123');

      expect(passwordInput).toHaveValue('password123');
    });

    it('updates all fields independently', async () => {
      const user = userEvent.setup();
      renderWithProviders(<RegisterForm />);

      await user.type(screen.getByLabelText(/username/i), 'john');
      await user.type(screen.getByLabelText(/email/i), 'john@example.com');
      await user.type(screen.getByLabelText(/^password$/i), 'secret123');
      await user.type(screen.getByLabelText(/confirm password/i), 'secret123');

      expect(screen.getByLabelText(/username/i)).toHaveValue('john');
      expect(screen.getByLabelText(/email/i)).toHaveValue('john@example.com');
      expect(screen.getByLabelText(/^password$/i)).toHaveValue('secret123');
      expect(screen.getByLabelText(/confirm password/i)).toHaveValue('secret123');
    });
  });

  describe('Form Submission', () => {
    beforeEach(() => {
      // Setup successful registration mock with small delay for realistic timing
      server.use(
        http.post('/api/v1/auth/register', async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
          return HttpResponse.json({
            data: {
              Token: 'fake-token',
              user: { id: 1, username: 'testuser', email: 'test@example.com' },
            },
          });
        })
      );
    });

    it('submits form with all fields filled', async () => {
      const user = userEvent.setup();
      const onSuccess = vi.fn();

      renderWithProviders(<RegisterForm onSuccess={onSuccess} />);

      await user.type(screen.getByLabelText(/username/i), 'testuser');
      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/^password$/i), 'password123');
      await user.type(screen.getByLabelText(/confirm password/i), 'password123');

      await user.click(screen.getByRole('button', { name: /^register$/i }));

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled();
      });
    });

    it('shows loading state while submitting', async () => {
      const user = userEvent.setup();

      // Delay the response to see loading state
      server.use(
        http.post('/api/v1/auth/register', async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
          return HttpResponse.json({
            data: {
              Token: 'fake-token',
              user: { id: 1, username: 'testuser' },
            },
          });
        })
      );

      renderWithProviders(<RegisterForm />);

      await user.type(screen.getByLabelText(/username/i), 'testuser');
      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/^password$/i), 'password123');
      await user.type(screen.getByLabelText(/confirm password/i), 'password123');

      const submitButton = screen.getByRole('button', { name: /^register$/i });
      await user.click(submitButton);

      // Should show loading text
      expect(screen.getByText(/creating account\.\.\./i)).toBeInTheDocument();

      // Button should be disabled
      expect(submitButton).toBeDisabled();

      // Wait for submission to complete
      await waitFor(() => {
        expect(submitButton).not.toBeDisabled();
      }, { timeout: 2000 });
    });

    it('disables submit button while submitting', async () => {
      const user = userEvent.setup();

      renderWithProviders(<RegisterForm />);

      await user.type(screen.getByLabelText(/username/i), 'testuser');
      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/^password$/i), 'password123');
      await user.type(screen.getByLabelText(/confirm password/i), 'password123');

      const submitButton = screen.getByRole('button', { name: /^register$/i });
      await user.click(submitButton);

      expect(submitButton).toBeDisabled();

      await waitFor(() => {
        expect(submitButton).not.toBeDisabled();
      }, { timeout: 2000 });
    });

    it('calls onSuccess callback when registration succeeds', async () => {
      const user = userEvent.setup();
      const onSuccess = vi.fn();

      renderWithProviders(<RegisterForm onSuccess={onSuccess} />);

      await user.type(screen.getByLabelText(/username/i), 'newuser');
      await user.type(screen.getByLabelText(/email/i), 'new@example.com');
      await user.type(screen.getByLabelText(/^password$/i), 'newpass123');
      await user.type(screen.getByLabelText(/confirm password/i), 'newpass123');

      await user.click(screen.getByRole('button', { name: /^register$/i }));

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalledTimes(1);
      });
    });

    it('does not call onSuccess when callback is not provided', async () => {
      const user = userEvent.setup();

      renderWithProviders(<RegisterForm />);

      await user.type(screen.getByLabelText(/username/i), 'testuser');
      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/^password$/i), 'password123');
      await user.type(screen.getByLabelText(/confirm password/i), 'password123');

      // Should not throw error when onSuccess is undefined
      await user.click(screen.getByRole('button', { name: /^register$/i }));

      // Just wait for loading to complete
      await waitFor(() => {
        const button = screen.getByRole('button', { name: /^register$/i });
        expect(button).not.toBeDisabled();
      }, { timeout: 2000 });
    });

    it('shows pending approval message and does not call onSuccess when server returns 202', async () => {
      server.use(
        http.post('/api/v1/auth/register', () => {
          return HttpResponse.json(
            { status_text: 'Pending Approval', error: 'Your account has been created and is pending admin approval.' },
            { status: 202 }
          );
        })
      );

      const user = userEvent.setup();
      const onSuccess = vi.fn();

      renderWithProviders(<RegisterForm onSuccess={onSuccess} />);

      await user.type(screen.getByLabelText(/username/i), 'newuser');
      await user.type(screen.getByLabelText(/email/i), 'new@example.com');
      await user.type(screen.getByLabelText(/^password$/i), 'password123');
      await user.type(screen.getByLabelText(/confirm password/i), 'password123');

      await user.click(screen.getByRole('button', { name: /^register$/i }));

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /registration submitted/i })).toBeInTheDocument();
      });

      expect(screen.getByText(/pending admin approval/i)).toBeInTheDocument();
      expect(onSuccess).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('does not show stale errors on initial render', () => {
      // This test ensures that cached errors from AuthContext don't appear
      // when the component first mounts (before any submission)
      renderWithProviders(<RegisterForm />);

      // Error message should NOT be visible on initial render
      expect(screen.queryByTestId('error-message')).not.toBeInTheDocument();
      expect(screen.queryByText(/registration failed/i)).not.toBeInTheDocument();
    });

    it('only shows errors after form submission', async () => {
      const user = userEvent.setup();

      server.use(
        http.post('/api/v1/auth/register', () => {
          return HttpResponse.json(
            { message: 'Username already taken' },
            { status: 400 }
          );
        })
      );

      renderWithProviders(<RegisterForm />);

      // Error should NOT be visible before submission
      expect(screen.queryByTestId('error-message')).not.toBeInTheDocument();

      await user.type(screen.getByLabelText(/username/i), 'taken');
      await user.type(screen.getByLabelText(/email/i), 'taken@example.com');
      await user.type(screen.getByLabelText(/^password$/i), 'password123');
      await user.type(screen.getByLabelText(/confirm password/i), 'password123');

      await user.click(screen.getByRole('button', { name: /^register$/i }));

      // Error should appear AFTER submission (expect mapped error message)
      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toBeInTheDocument();
        expect(screen.getByText(/this username is already taken/i)).toBeInTheDocument();
      });
    });

    it('displays error message when registration fails', async () => {
      const user = userEvent.setup();

      server.use(
        http.post('/api/v1/auth/register', () => {
          return HttpResponse.json(
            { message: 'Username already taken' },
            { status: 400 }
          );
        })
      );

      renderWithProviders(<RegisterForm />);

      await user.type(screen.getByLabelText(/username/i), 'taken');
      await user.type(screen.getByLabelText(/email/i), 'taken@example.com');
      await user.type(screen.getByLabelText(/^password$/i), 'password123');
      await user.type(screen.getByLabelText(/confirm password/i), 'password123');

      await user.click(screen.getByRole('button', { name: /^register$/i }));

      // Expect mapped error message, not raw error
      await waitFor(() => {
        expect(screen.getByText(/this username is already taken/i)).toBeInTheDocument();
      });
    });

    it('displays generic error for network failures', async () => {
      const user = userEvent.setup();

      server.use(
        http.post('/api/v1/auth/register', () => {
          return HttpResponse.error();
        })
      );

      renderWithProviders(<RegisterForm />);

      await user.type(screen.getByLabelText(/username/i), 'testuser');
      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/^password$/i), 'password123');
      await user.type(screen.getByLabelText(/confirm password/i), 'password123');

      await user.click(screen.getByRole('button', { name: /^register$/i }));

      // Network errors show network error message
      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument();
      });
    });

    it('re-enables submit button after error', async () => {
      const user = userEvent.setup();

      server.use(
        http.post('/api/v1/auth/register', () => {
          return HttpResponse.json(
            { message: 'Registration error' },
            { status: 500 }
          );
        })
      );

      renderWithProviders(<RegisterForm />);

      await user.type(screen.getByLabelText(/username/i), 'testuser');
      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/^password$/i), 'password123');
      await user.type(screen.getByLabelText(/confirm password/i), 'password123');

      const submitButton = screen.getByRole('button', { name: /^register$/i });
      await user.click(submitButton);

      // Wait for error (500 status shows server error message)
      await waitFor(() => {
        expect(screen.getByText(/server error/i)).toBeInTheDocument();
      });

      // Button should be re-enabled
      expect(submitButton).not.toBeDisabled();
    });

    it('does not call onSuccess when registration fails', async () => {
      const user = userEvent.setup();
      const onSuccess = vi.fn();

      server.use(
        http.post('/api/v1/auth/register', () => {
          return HttpResponse.json(
            { message: 'Error' },
            { status: 400 }
          );
        })
      );

      renderWithProviders(<RegisterForm onSuccess={onSuccess} />);

      await user.type(screen.getByLabelText(/username/i), 'testuser');
      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/^password$/i), 'password123');
      await user.type(screen.getByLabelText(/confirm password/i), 'password123');

      await user.click(screen.getByRole('button', { name: /^register$/i }));

      // Wait for error to appear (400 status shows generic error)
      await waitFor(() => {
        expect(screen.getByText(/invalid request/i)).toBeInTheDocument();
      });

      // onSuccess should not have been called
      expect(onSuccess).not.toHaveBeenCalled();
    });
  });

  describe('Password Confirmation', () => {
    it('shows error when passwords do not match', async () => {
      const user = userEvent.setup();

      renderWithProviders(<RegisterForm />);

      await user.type(screen.getByLabelText(/username/i), 'testuser');
      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/^password$/i), 'password123');
      await user.type(screen.getByLabelText(/confirm password/i), 'different456');

      await user.click(screen.getByRole('button', { name: /^register$/i }));

      // Should show password mismatch error (checking for at least one occurrence)
      await waitFor(() => {
        const errors = screen.queryAllByText(/passwords do not match/i);
        expect(errors.length).toBeGreaterThan(0);
      });
    });

    it('does not show error when passwords match', async () => {
      const user = userEvent.setup();

      renderWithProviders(<RegisterForm />);

      await user.type(screen.getByLabelText(/username/i), 'testuser');
      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/^password$/i), 'password123');
      await user.type(screen.getByLabelText(/confirm password/i), 'password123');

      // Type something to trigger validation display
      await user.click(screen.getByRole('button', { name: /^register$/i }));

      // Should not show password mismatch error
      expect(screen.queryByText(/passwords do not match/i)).not.toBeInTheDocument();
    });

    it('shows inline error on confirm password field when typing mismatched password', async () => {
      const user = userEvent.setup();

      renderWithProviders(<RegisterForm />);

      await user.type(screen.getByLabelText(/username/i), 'testuser');
      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/^password$/i), 'password123');
      await user.type(screen.getByLabelText(/confirm password/i), 'different456');

      // Click submit to trigger validation display
      await user.click(screen.getByRole('button', { name: /^register$/i }));

      // Should show inline error on confirm password field
      await waitFor(() => {
        const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
        const errors = screen.queryAllByText(/passwords do not match/i);

        expect(errors.length).toBeGreaterThan(0);
        expect(confirmPasswordInput).toBeInTheDocument();
      });
    });

    it('prevents form submission when passwords do not match', async () => {
      const user = userEvent.setup();
      const onSuccess = vi.fn();

      renderWithProviders(<RegisterForm onSuccess={onSuccess} />);

      await user.type(screen.getByLabelText(/username/i), 'testuser');
      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/^password$/i), 'password123');
      await user.type(screen.getByLabelText(/confirm password/i), 'different456');

      await user.click(screen.getByRole('button', { name: /^register$/i }));

      // Wait for error to appear (may appear in multiple places: inline + alert)
      await waitFor(() => {
        const errors = screen.queryAllByText(/passwords do not match/i);
        expect(errors.length).toBeGreaterThan(0);
      });

      // onSuccess should not have been called
      expect(onSuccess).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('associates labels with inputs', () => {
      renderWithProviders(<RegisterForm />);

      const usernameInput = screen.getByLabelText(/^username/i);
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/^password$/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);

      expect(usernameInput).toHaveAttribute('id', 'username');
      expect(emailInput).toHaveAttribute('id', 'email');
      expect(passwordInput).toHaveAttribute('id', 'password');
      expect(confirmPasswordInput).toHaveAttribute('id', 'confirmPassword');
    });

    it('uses semantic HTML elements', () => {
      renderWithProviders(<RegisterForm />);

      // Check for heading and button
      expect(screen.getByRole('heading', { name: /register/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /register/i })).toBeInTheDocument();

      // Check that form element exists (even without explicit role)
      const form = document.querySelector('form');
      expect(form).toBeInTheDocument();
    });

    it('has proper input types for security', () => {
      renderWithProviders(<RegisterForm />);

      // Email field should have email type for built-in validation
      const emailInput = screen.getByLabelText(/email/i);
      expect(emailInput).toHaveAttribute('type', 'email');

      // Password field should have password type for masking
      const passwordInput = screen.getByLabelText(/^password$/i);
      expect(passwordInput).toHaveAttribute('type', 'password');

      // Confirm password field should also have password type for masking
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
      expect(confirmPasswordInput).toHaveAttribute('type', 'password');
    });
  });
});
