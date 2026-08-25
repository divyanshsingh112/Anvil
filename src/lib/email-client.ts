import fs from 'fs';
import path from 'path';
import { Resend } from 'resend';

// From address constant (send.anvilapp.online is verified on Resend)
export const EMAIL_FROM = 'Anvil <hello@send.anvilapp.online>';

/**
 * Sends an email verification link to a user.
 * 
 * @param to - Recipient email address
 * @param verifyUrl - Verification URL to inject into the template
 */
export async function sendVerificationEmail(to: string, verifyUrl: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[sendVerificationEmail] RESEND_API_KEY is not configured. Email sending skipped.');
    return { success: false, error: 'RESEND_API_KEY is missing' };
  }

  try {
    const templatePath = path.join(process.cwd(), 'src', 'lib', 'email-templates', 'verify-email.html');
    const rawTemplate = fs.readFileSync(templatePath, 'utf8');

    // Replace all occurrences of {{VERIFY_URL}} (in button href, VML href, and fallback plain-text link)
    const htmlContent = rawTemplate.replaceAll('{{VERIFY_URL}}', verifyUrl);

    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to,
      subject: 'One click to light your forge 🔥',
      html: htmlContent,
    });

    if (error) {
      console.error('[sendVerificationEmail] Resend API error:', error);
      return { success: false, error };
    }

    console.log(`[sendVerificationEmail] Verification email sent successfully to ${to}. Message ID: ${data?.id}`);
    return { success: true, data };
  } catch (err) {
    console.error('[sendVerificationEmail] Failed to send verification email:', err);
    return { success: false, error: err };
  }
}
