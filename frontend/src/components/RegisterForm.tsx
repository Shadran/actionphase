import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button, Input, Card, Alert } from './ui';
import { HCaptchaWrapper } from './HCaptcha';
import { mapAuthError, validatePasswordRequirements } from '../lib/utils/errorMapper';
import { CheckCircle, XCircle } from 'lucide-react';
import { getDeviceFingerprint } from '../lib/fingerprint';
import type { RegisterRequest } from '../types/auth';

interface RegisterFormProps {
  onSuccess?: () => void;
}

export const RegisterForm = ({ onSuccess }: RegisterFormProps) => {
  const captchaEnabled = import.meta.env.VITE_HCAPTCHA_ENABLED === 'true';

  const [formData, setFormData] = useState<RegisterRequest>({
    username: '',
    email: '',
    password: '',
    hcaptcha_token: captchaEnabled ? '' : 'dev-bypass-token',
    honeypot_value: '',
  });
  const [confirmPassword, setConfirmPassword] = useState('');
  const { register, isLoading } = useAuth();
  const [captchaError, setCaptchaError] = useState<string>('');
  const [submittedOnce, setSubmittedOnce] = useState(false);
  const [registrationError, setRegistrationError] = useState<unknown>(null);
  const [pendingApproval, setPendingApproval] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittedOnce(true);
    setRegistrationError(null);

    // Validate passwords match
    if (formData.password !== confirmPassword) {
      setRegistrationError({ message: 'Passwords do not match' });
      return;
    }

    // Validate captcha token (only required if HCAPTCHA_ENABLED is true)
    if (captchaEnabled && !formData.hcaptcha_token) {
      setCaptchaError('Please complete the CAPTCHA verification');
      return;
    }

    setCaptchaError('');

    try {
      const fingerprint = await getDeviceFingerprint();
      const response = await register({ ...formData, fingerprint: fingerprint ?? undefined });
      if (response.status === 202) {
        setPendingApproval(true);
      } else {
        onSuccess?.();
      }
    } catch (_err) {
      // Store the error for display
      setRegistrationError(_err);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCaptchaVerify = (token: string) => {
    setFormData(prev => ({
      ...prev,
      hcaptcha_token: token,
    }));
    setCaptchaError('');
  };

  const handleCaptchaExpire = () => {
    setFormData(prev => ({
      ...prev,
      hcaptcha_token: '',
    }));
    setCaptchaError('CAPTCHA expired, please verify again');
  };

  const passwordRequirements = validatePasswordRequirements(formData.password);
  const errorMessage: string = registrationError ? mapAuthError(registrationError) : '';

  // Workaround for TypeScript 5.8/5.9 bug - extract conditional JSX to variables
  // Bug: TypeScript incorrectly infers conditional JSX as 'unknown' in presence of errorMapper
  const captchaWidget: React.ReactElement | null = captchaEnabled ? (
    <>
      <HCaptchaWrapper
        onVerify={handleCaptchaVerify}
        onExpire={handleCaptchaExpire}
      />
      {captchaError && (
        <Alert variant="warning">
          {captchaError}
        </Alert>
      )}
    </>
  ) : null;

  const errorAlert: React.ReactElement | null = (registrationError && submittedOnce) ? (
    <Alert variant="danger" data-testid="error-message">
      {errorMessage}
    </Alert>
  ) : null;

  if (pendingApproval) {
    return (
      <Card variant="elevated" padding="md" className="max-w-md mx-auto">
        <h2 className="text-2xl font-bold text-content-primary mb-4">Registration Submitted</h2>
        <p className="text-content-secondary">
          Your account has been created and is pending admin approval. You will be able to log in once an admin reviews your request.
        </p>
      </Card>
    );
  }

  return (
    <Card variant="elevated" padding="md" className="max-w-md mx-auto">
      <h2 className="text-2xl font-bold text-content-primary mb-6">Register</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Username"
          id="username"
          name="username"
          type="text"
          required
          value={formData.username}
          onChange={handleChange}
          placeholder="Choose a username"
          data-testid="register-username"
        />

        <Input
          label="Email"
          id="email"
          name="email"
          type="email"
          required
          value={formData.email}
          onChange={handleChange}
          placeholder="Enter your email"
          data-testid="register-email"
        />

        <div>
          <Input
            label="Password"
            id="password"
            name="password"
            type="password"
            required
            value={formData.password}
            onChange={handleChange}
            placeholder="Choose a password"
            data-testid="register-password"
          />

          {/* Password requirements display */}
          {formData.password && (
            <div className="mt-3 space-y-2" data-testid="password-requirements">
              <p className="text-sm font-medium text-content-secondary">
                Password Requirements:
              </p>
              <div className="space-y-1">
                {passwordRequirements.map((req) => (
                  <div
                    key={req.key}
                    className="flex items-center gap-2 text-sm"
                    data-testid={`password-requirement-${req.key}`}
                  >
                    {req.met ? (
                      <CheckCircle className="text-semantic-success flex-shrink-0" size={16} />
                    ) : (
                      <XCircle className="text-content-tertiary flex-shrink-0" size={16} />
                    )}
                    <span className={req.met ? 'text-semantic-success' : 'text-content-secondary'}>
                      {req.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <Input
          label="Confirm Password"
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Re-enter your password"
          error={
            submittedOnce && confirmPassword && formData.password !== confirmPassword
              ? 'Passwords do not match'
              : undefined
          }
          data-testid="register-confirm-password"
        />

        {/* Honeypot field - hidden from users, catches bots */}
        <div style={{ position: 'absolute', left: '-9999px' }}>
          <Input
            label="Leave this field empty"
            id="honeypot"
            name="honeypot_value"
            type="text"
            value={formData.honeypot_value}
            onChange={handleChange}
            tabIndex={-1}
            autoComplete="off"
          />
        </div>

        {captchaWidget}

        {errorAlert}

        <Button
          type="submit"
          variant="primary"
          loading={isLoading}
          className="w-full"
          data-testid="register-submit"
        >
          {isLoading ? 'Creating account...' : 'Register'}
        </Button>
      </form>
    </Card>
  );
};
