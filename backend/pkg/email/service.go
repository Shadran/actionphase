package email

import (
	"context"
	"crypto/tls"
	"fmt"
	"os"
	"time"

	"github.com/resend/resend-go/v2"
	"gopkg.in/gomail.v2"

	"actionphase/pkg/core"
)

// Compile-time verification that EmailService implements EmailServiceInterface
var _ core.EmailServiceInterface = (*EmailService)(nil)

// EmailProvider defines the type of email provider
type EmailProvider string

const (
	ProviderResend  EmailProvider = "resend"
	ProviderMailHog EmailProvider = "mailhog"
	ProviderSMTP    EmailProvider = "smtp"
)

// Config holds email service configuration
type Config struct {
	Provider     EmailProvider
	FromEmail    string
	FromName     string
	ResendAPIKey string
	SMTPHost     string
	SMTPPort     int
	SMTPUsername string
	SMTPPassword string
	SMTPUseTLS   bool
}

// EmailService implements EmailServiceInterface
type EmailService struct {
	config        Config
	resendClient  *resend.Client
	smtpDialer    *gomail.Dialer
	templateCache map[string]string
}

// NewEmailService creates a new EmailService instance
func NewEmailService(config Config) (*EmailService, error) {
	service := &EmailService{
		config:        config,
		templateCache: make(map[string]string),
	}

	// Initialize provider-specific clients
	switch config.Provider {
	case ProviderResend:
		if config.ResendAPIKey == "" {
			return nil, fmt.Errorf("resend API key is required for resend provider")
		}
		service.resendClient = resend.NewClient(config.ResendAPIKey)

	case ProviderMailHog, ProviderSMTP:
		if config.SMTPHost == "" {
			return nil, fmt.Errorf("SMTP host is required for mailhog/smtp provider")
		}
		if config.SMTPPort == 0 {
			config.SMTPPort = 1025 // Default MailHog port
		}

		service.smtpDialer = gomail.NewDialer(
			config.SMTPHost,
			config.SMTPPort,
			config.SMTPUsername,
			config.SMTPPassword,
		)

		// Disable TLS for MailHog
		if config.Provider == ProviderMailHog || !config.SMTPUseTLS {
			service.smtpDialer.TLSConfig = &tls.Config{InsecureSkipVerify: true}
		}

	default:
		return nil, fmt.Errorf("unsupported email provider: %s", config.Provider)
	}

	return service, nil
}

// SendEmail sends a generic email
func (s *EmailService) SendEmail(ctx context.Context, req *core.SendEmailRequest) error {
	switch s.config.Provider {
	case ProviderResend:
		return s.sendWithResend(ctx, req)
	case ProviderMailHog, ProviderSMTP:
		return s.sendWithSMTP(ctx, req)
	default:
		return fmt.Errorf("unsupported email provider: %s", s.config.Provider)
	}
}

// sendWithResend sends email using Resend API
func (s *EmailService) sendWithResend(ctx context.Context, req *core.SendEmailRequest) error {
	params := &resend.SendEmailRequest{
		From:    fmt.Sprintf("%s <%s>", s.config.FromName, s.config.FromEmail),
		To:      []string{req.To},
		Subject: req.Subject,
		Html:    req.HTMLBody,
		Text:    req.TextBody,
	}

	_, err := s.resendClient.Emails.SendWithContext(ctx, params)
	if err != nil {
		return fmt.Errorf("failed to send email via resend: %w", err)
	}

	return nil
}

// sendWithSMTP sends email using SMTP (MailHog or generic SMTP)
func (s *EmailService) sendWithSMTP(ctx context.Context, req *core.SendEmailRequest) error {
	m := gomail.NewMessage()
	m.SetHeader("From", fmt.Sprintf("%s <%s>", s.config.FromName, s.config.FromEmail))
	m.SetHeader("To", req.To)
	m.SetHeader("Subject", req.Subject)

	if req.HTMLBody != "" {
		m.SetBody("text/html", req.HTMLBody)
		if req.TextBody != "" {
			m.AddAlternative("text/plain", req.TextBody)
		}
	} else {
		m.SetBody("text/plain", req.TextBody)
	}

	if err := s.smtpDialer.DialAndSend(m); err != nil {
		return fmt.Errorf("failed to send email via SMTP: %w", err)
	}

	return nil
}

// SendPasswordResetEmail sends a password reset email with token
func (s *EmailService) SendPasswordResetEmail(ctx context.Context, email, token, resetURL string) error {
	subject := "Reset Your Password"
	htmlBody := s.renderPasswordResetTemplate(resetURL)
	textBody := fmt.Sprintf("Reset your password by visiting: %s\n\nThis link expires in 1 hour.", resetURL)

	return s.SendEmail(ctx, &core.SendEmailRequest{
		To:       email,
		Subject:  subject,
		HTMLBody: htmlBody,
		TextBody: textBody,
	})
}

// SendEmailVerificationEmail sends an email verification link
func (s *EmailService) SendEmailVerificationEmail(ctx context.Context, email, token, verifyURL string) error {
	subject := "Verify Your Email Address"
	htmlBody := s.renderEmailVerificationTemplate(verifyURL)
	textBody := fmt.Sprintf("Verify your email address by visiting: %s\n\nThis link expires in 1 hour.", verifyURL)

	return s.SendEmail(ctx, &core.SendEmailRequest{
		To:       email,
		Subject:  subject,
		HTMLBody: htmlBody,
		TextBody: textBody,
	})
}

// SendPasswordChangedEmail notifies user of password change
func (s *EmailService) SendPasswordChangedEmail(ctx context.Context, email string) error {
	subject := "Your Password Has Been Changed"
	htmlBody := s.renderPasswordChangedTemplate()
	textBody := "Your password has been successfully changed. If you did not make this change, please contact support immediately."

	return s.SendEmail(ctx, &core.SendEmailRequest{
		To:       email,
		Subject:  subject,
		HTMLBody: htmlBody,
		TextBody: textBody,
	})
}

// SendEmailChangedEmail notifies user of email change
func (s *EmailService) SendEmailChangedEmail(ctx context.Context, oldEmail, newEmail string) error {
	subject := "Your Email Address Has Been Changed"
	htmlBody := s.renderEmailChangedTemplate(newEmail)
	textBody := fmt.Sprintf("Your email address has been changed to: %s\n\nIf you did not make this change, please contact support immediately.", newEmail)

	// Send to BOTH old and new email addresses
	if err := s.SendEmail(ctx, &core.SendEmailRequest{
		To:       oldEmail,
		Subject:  subject,
		HTMLBody: htmlBody,
		TextBody: textBody,
	}); err != nil {
		return fmt.Errorf("failed to send notification to old email: %w", err)
	}

	if err := s.SendEmail(ctx, &core.SendEmailRequest{
		To:       newEmail,
		Subject:  subject,
		HTMLBody: htmlBody,
		TextBody: textBody,
	}); err != nil {
		return fmt.Errorf("failed to send notification to new email: %w", err)
	}

	return nil
}

// SendAccountDeletionScheduledEmail notifies user account will be deleted
func (s *EmailService) SendAccountDeletionScheduledEmail(ctx context.Context, userEmail string, scheduledFor time.Time) error {
	subject := "Your Account Deletion Has Been Scheduled"
	htmlBody := s.renderAccountDeletionTemplate(scheduledFor.Format("January 2, 2006"))
	textBody := fmt.Sprintf("Your account is scheduled for deletion on %s.\n\nYou can cancel this by logging in and going to your account settings.", scheduledFor.Format("January 2, 2006"))

	return s.SendEmail(ctx, &core.SendEmailRequest{
		To:       userEmail,
		Subject:  subject,
		HTMLBody: htmlBody,
		TextBody: textBody,
	})
}

// NewEmailServiceFromEnv creates EmailService from environment variables
func NewEmailServiceFromEnv() (*EmailService, error) {
	provider := EmailProvider(os.Getenv("EMAIL_PROVIDER"))
	if provider == "" {
		provider = ProviderMailHog // Default to MailHog for development
	}

	config := Config{
		Provider:     provider,
		FromEmail:    os.Getenv("EMAIL_FROM"),
		FromName:     os.Getenv("EMAIL_FROM_NAME"),
		ResendAPIKey: os.Getenv("RESEND_API_KEY"),
		SMTPHost:     os.Getenv("SMTP_HOST"),
		SMTPUsername: os.Getenv("SMTP_USERNAME"),
		SMTPPassword: os.Getenv("SMTP_PASSWORD"),
		SMTPUseTLS:   os.Getenv("SMTP_USE_TLS") == "true",
	}

	// Set default values
	if config.FromEmail == "" {
		config.FromEmail = "noreply@action-phase.com"
	}
	if config.FromName == "" {
		config.FromName = "ActionPhase"
	}
	if config.SMTPHost == "" && (provider == ProviderMailHog || provider == ProviderSMTP) {
		config.SMTPHost = "localhost"
	}
	if config.SMTPPort == 0 && provider == ProviderMailHog {
		config.SMTPPort = 1025
	}

	return NewEmailService(config)
}
