import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useErrorHandler } from '../hooks/useErrorHandler';
import { ErrorDisplay } from './ErrorDisplay';
import { Input, Button } from './ui';
import { getDeviceFingerprint } from '../lib/fingerprint';
import type { LoginRequest } from '../types/auth';

interface LoginFormProps {
  onSuccess?: () => void;
  hideForgotPassword?: boolean;
}

export const LoginForm = ({ onSuccess, hideForgotPassword = false }: LoginFormProps) => {
  const [formData, setFormData] = useState<LoginRequest>({
    username: '',
    password: '',
  });
  const { login, isLoading } = useAuth();
  const { error, handleError, clearError } = useErrorHandler();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    try {
      const fingerprint = await getDeviceFingerprint();
      await login({ ...formData, fingerprint: fingerprint ?? undefined });
      onSuccess?.();
    } catch (_err) {
      handleError(_err);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  return (
    <div className="max-w-md mx-auto surface-base rounded-lg shadow-md border border-theme-default p-6">
      <h2 className="text-2xl font-bold text-content-primary mb-6">Login</h2>

      <form onSubmit={handleSubmit} className="space-y-4" data-testid="login-form">
        <Input
          label="Username or Email"
          id="username"
          name="username"
          type="text"
          required
          value={formData.username}
          onChange={handleChange}
          placeholder="Enter your username or email"
          data-testid="login-username"
        />

        <Input
          label="Password"
          id="password"
          name="password"
          type="password"
          required
          value={formData.password}
          onChange={handleChange}
          placeholder="Enter your password"
          data-testid="login-password"
        />

        <ErrorDisplay
          error={error}
          onRetry={() => {
            const formEvent = { preventDefault: () => {} } as React.FormEvent<HTMLFormElement>;
            handleSubmit(formEvent);
          }}
          onDismiss={clearError}
          compact
        />

        {!hideForgotPassword && (
          <div className="flex items-center justify-end mb-4">
            <Link
              to="/forgot-password"
              className="text-sm text-interactive-primary hover:text-interactive-hover"
            >
              Forgot password?
            </Link>
          </div>
        )}

        <Button
          type="submit"
          variant="primary"
          loading={isLoading}
          className="w-full"
          data-testid="login-submit"
        >
          Login
        </Button>
      </form>
    </div>
  );
};
