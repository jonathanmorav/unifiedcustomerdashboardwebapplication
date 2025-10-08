import { log } from "@/lib/logger"
import { CorrelationTracking } from "@/lib/security/correlation"

export interface EmailOptions {
  to: string | string[]
  subject: string
  html?: string
  text?: string
  from?: string
  replyTo?: string
  correlationId?: string
}

export interface EmailTemplate {
  subject: string
  html: string
  text: string
}

export interface EmailProvider {
  send(options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }>
}

// Mock provider for development - replace with actual provider (SendGrid, SES, etc.)
class MockEmailProvider implements EmailProvider {
  async send(
    options: EmailOptions
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    await log.info("Mock email sent", {
      to: options.to,
      subject: options.subject,
      correlationId: options.correlationId,
      operation: "email_send_mock",
    })

    return {
      success: true,
      messageId: `mock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    }
  }
}

export class EmailService {
  private static provider: EmailProvider = new MockEmailProvider()
  private static readonly FROM_ADDRESS =
    process.env.EMAIL_FROM_ADDRESS || "noreply@unified-dashboard.com"
  private static readonly REPLY_TO_ADDRESS =
    process.env.EMAIL_REPLY_TO || "support@unified-dashboard.com"

  /**
   * Set the email provider (for testing or switching providers)
   */
  static setProvider(provider: EmailProvider): void {
    this.provider = provider
  }

  /**
   * Send an email using the configured provider
   */
  private static async send(options: EmailOptions): Promise<{ success: boolean; error?: string }> {
    try {
      const correlationId = options.correlationId || (await CorrelationTracking.getCorrelationId()) || undefined

      const result = await this.provider.send({
        ...options,
        from: options.from || this.FROM_ADDRESS,
        replyTo: options.replyTo || this.REPLY_TO_ADDRESS,
        correlationId,
      })

      if (result.success) {
        await log.info("Email sent successfully", {
          to: options.to,
          subject: options.subject,
          messageId: result.messageId,
          correlationId,
          operation: "email_send_success",
        })
      } else {
        await log.error("Email send failed", new Error(result.error || "Unknown error"), {
          to: options.to,
          subject: options.subject,
          correlationId: correlationId || undefined,
          operation: "email_send_failed",
        })
      }

      return result
    } catch (error) {
      await log.error("Email service error", error instanceof Error ? error : new Error("Unknown error"), {
        to: options.to,
        subject: options.subject,
        correlationId: options.correlationId || undefined,
        operation: "email_service_error",
      })
      return { success: false, error: "Failed to send email" }
    }
  }

  /**
   * Send account lockout notification
   */
  static async sendAccountLockoutNotification(
    email: string,
    lockedUntil: Date,
    ipAddress?: string
  ): Promise<{ success: boolean; error?: string }> {
    const template = this.getAccountLockoutTemplate(email, lockedUntil, ipAddress)

    return this.send({
      to: email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    })
  }

  /**
   * Send security alert notification
   */
  static async sendSecurityAlert(
    email: string,
    alertType: "new_device" | "suspicious_activity" | "password_changed" | "mfa_disabled",
    details: Record<string, any>
  ): Promise<{ success: boolean; error?: string }> {
    const template = this.getSecurityAlertTemplate(email, alertType, details)

    return this.send({
      to: email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    })
  }

  /**
   * Send MFA backup codes warning
   */
  static async sendBackupCodesWarning(
    email: string,
    remainingCodes: number
  ): Promise<{ success: boolean; error?: string }> {
    const template = this.getBackupCodesWarningTemplate(email, remainingCodes)

    return this.send({
      to: email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    })
  }

  /**
   * Notify security team of escalated event
   */
  static async notifySecurityTeam(
    userId: string,
    event: string,
    details: Record<string, any>
  ): Promise<{ success: boolean; error?: string }> {
    const securityEmails = (process.env.SECURITY_TEAM_EMAILS || "").split(",").filter(Boolean)

    if (securityEmails.length === 0) {
      await log.warn("No security team emails configured", {
        userId,
        event,
        operation: "security_notification_skipped",
      })
      return { success: true }
    }

    const template = this.getSecurityEscalationTemplate(userId, event, details)

    return this.send({
      to: securityEmails,
      subject: template.subject,
      html: template.html,
      text: template.text,
    })
  }

  // Email Templates

  private static getAccountLockoutTemplate(
    email: string,
    lockedUntil: Date,
    ipAddress?: string
  ): EmailTemplate {
    const unlockTime = lockedUntil.toLocaleString()

    return {
      subject: "Security Alert: Your account has been locked",
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>Account Locked</title>
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #d9534f;">Security Alert: Account Locked</h2>
              
              <p>Your account has been temporarily locked due to multiple failed login attempts.</p>
              
              <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <p><strong>Account:</strong> ${email}</p>
                <p><strong>Locked until:</strong> ${unlockTime}</p>
                ${ipAddress ? `<p><strong>IP Address:</strong> ${ipAddress}</p>` : ""}
              </div>
              
              <h3>What to do next:</h3>
              <ul>
                <li>Wait until ${unlockTime} to try logging in again</li>
                <li>If you didn't make these attempts, please contact our security team immediately</li>
                <li>Consider enabling two-factor authentication for additional security</li>
              </ul>
              
              <p style="color: #666; font-size: 14px; margin-top: 30px;">
                If you believe this is an error or need immediate assistance, please contact our support team.
              </p>
              
              <hr style="border: 1px solid #eee; margin: 30px 0;">
              
              <p style="color: #999; font-size: 12px;">
                This is an automated security notification. Please do not reply to this email.
              </p>
            </div>
          </body>
        </html>
      `,
      text: `
Security Alert: Account Locked

Your account has been temporarily locked due to multiple failed login attempts.

Account: ${email}
Locked until: ${unlockTime}
${ipAddress ? `IP Address: ${ipAddress}` : ""}

What to do next:
- Wait until ${unlockTime} to try logging in again
- If you didn't make these attempts, please contact our security team immediately
- Consider enabling two-factor authentication for additional security

If you believe this is an error or need immediate assistance, please contact our support team.

This is an automated security notification.
      `.trim(),
    }
  }

  private static getSecurityAlertTemplate(
    email: string,
    alertType: string,
    details: Record<string, any>
  ): EmailTemplate {
    const alertTitles: Record<string, string> = {
      new_device: "New Device Login Detected",
      suspicious_activity: "Suspicious Activity Detected",
      password_changed: "Password Changed Successfully",
      mfa_disabled: "Two-Factor Authentication Disabled",
    }

    const title = alertTitles[alertType] || "Security Alert"

    return {
      subject: `Security Alert: ${title}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>${title}</title>
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #f0ad4e;">${title}</h2>
              
              <p>We detected the following activity on your account:</p>
              
              <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <p><strong>Account:</strong> ${email}</p>
                <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
                ${details.ipAddress ? `<p><strong>IP Address:</strong> ${details.ipAddress}</p>` : ""}
                ${details.userAgent ? `<p><strong>Device:</strong> ${details.userAgent}</p>` : ""}
              </div>
              
              <p>If this was you, no action is needed. If you don't recognize this activity, please:</p>
              <ol>
                <li>Change your password immediately</li>
                <li>Review your recent account activity</li>
                <li>Enable two-factor authentication if not already active</li>
              </ol>
              
              <hr style="border: 1px solid #eee; margin: 30px 0;">
              
              <p style="color: #999; font-size: 12px;">
                This is an automated security notification. Please do not reply to this email.
              </p>
            </div>
          </body>
        </html>
      `,
      text: `
${title}

We detected the following activity on your account:

Account: ${email}
Time: ${new Date().toLocaleString()}
${details.ipAddress ? `IP Address: ${details.ipAddress}` : ""}
${details.userAgent ? `Device: ${details.userAgent}` : ""}

If this was you, no action is needed. If you don't recognize this activity, please:
1. Change your password immediately
2. Review your recent account activity
3. Enable two-factor authentication if not already active

This is an automated security notification.
      `.trim(),
    }
  }

  private static getBackupCodesWarningTemplate(
    email: string,
    remainingCodes: number
  ): EmailTemplate {
    return {
      subject: "Action Required: Low on Backup Codes",
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>Low Backup Codes Warning</title>
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #f0ad4e;">Low on Backup Codes</h2>
              
              <p>You have only <strong>${remainingCodes}</strong> backup codes remaining for your two-factor authentication.</p>
              
              <p>Backup codes are essential for accessing your account if you lose access to your authentication device.</p>
              
              <div style="background-color: #d4edda; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <p><strong>Recommended Action:</strong> Generate new backup codes now to ensure continued access to your account.</p>
              </div>
              
              <p>To generate new backup codes:</p>
              <ol>
                <li>Log in to your account</li>
                <li>Go to Security Settings</li>
                <li>Click "Regenerate Backup Codes"</li>
                <li>Save the new codes in a secure location</li>
              </ol>
              
              <hr style="border: 1px solid #eee; margin: 30px 0;">
              
              <p style="color: #999; font-size: 12px;">
                This is an automated security notification. Please do not reply to this email.
              </p>
            </div>
          </body>
        </html>
      `,
      text: `
Low on Backup Codes

You have only ${remainingCodes} backup codes remaining for your two-factor authentication.

Backup codes are essential for accessing your account if you lose access to your authentication device.

Recommended Action: Generate new backup codes now to ensure continued access to your account.

To generate new backup codes:
1. Log in to your account
2. Go to Security Settings
3. Click "Regenerate Backup Codes"
4. Save the new codes in a secure location

This is an automated security notification.
      `.trim(),
    }
  }

  private static getSecurityEscalationTemplate(
    userId: string,
    event: string,
    details: Record<string, any>
  ): EmailTemplate {
    return {
      subject: `[SECURITY ESCALATION] ${event}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>Security Escalation</title>
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #d9534f;">Security Escalation Required</h2>
              
              <div style="background-color: #f8d7da; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <p><strong>Event:</strong> ${event}</p>
                <p><strong>User ID:</strong> ${userId}</p>
                <p><strong>Time:</strong> ${new Date().toISOString()}</p>
              </div>
              
              <h3>Event Details:</h3>
              <pre style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; overflow-x: auto;">
${JSON.stringify(details, null, 2)}
              </pre>
              
              <p style="color: #666; margin-top: 30px;">
                Please investigate this security event and take appropriate action.
              </p>
            </div>
          </body>
        </html>
      `,
      text: `
SECURITY ESCALATION REQUIRED

Event: ${event}
User ID: ${userId}
Time: ${new Date().toISOString()}

Event Details:
${JSON.stringify(details, null, 2)}

Please investigate this security event and take appropriate action.
      `.trim(),
    }
  }
}
