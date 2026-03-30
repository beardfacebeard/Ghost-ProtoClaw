import { Resend } from "resend";

import { getResendApiKey, getResendFromEmail } from "@/lib/auth/config";

type SendEmailParams = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

function getResendClient() {
  try {
    return new Resend(getResendApiKey());
  } catch (error) {
    console.error("Resend is not configured.", error);
    return null;
  }
}

function buildEmailTemplate(params: {
  title: string;
  bodyHtml: string;
  ctaLabel: string;
  ctaLink: string;
  footerText: string;
}) {
  const html = `
    <div style="margin:0;padding:32px;background-color:#0a0a0a;font-family:Inter,Segoe UI,sans-serif;color:#ffffff;">
      <div style="max-width:600px;margin:0 auto;border:1px solid #2a2a2a;border-radius:20px;background-color:#1a1a1a;overflow:hidden;">
        <div style="padding:32px 32px 12px 32px;">
          <div style="font-size:22px;font-weight:700;letter-spacing:0.04em;color:#ffffff;">Ghost ProtoClaw</div>
          <div style="margin-top:8px;color:#a1a1aa;font-size:14px;">Complex tech. Invisible effort.</div>
        </div>
        <div style="padding:12px 32px 32px 32px;">
          <h1 style="margin:0 0 16px 0;font-size:24px;line-height:1.3;color:#ffffff;">${params.title}</h1>
          <div style="color:#e4e4e7;font-size:15px;line-height:1.7;">${params.bodyHtml}</div>
          <div style="margin-top:28px;">
            <a href="${params.ctaLink}" style="display:inline-block;padding:14px 22px;background-color:#e63946;color:#ffffff;text-decoration:none;border-radius:12px;font-weight:600;">
              ${params.ctaLabel}
            </a>
          </div>
          <div style="margin-top:28px;color:#71717a;font-size:13px;line-height:1.6;">
            ${params.footerText}
          </div>
        </div>
      </div>
    </div>
  `;

  const text = [
    "Ghost ProtoClaw",
    "Complex tech. Invisible effort.",
    "",
    params.title,
    "",
    params.bodyHtml
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<[^>]+>/g, "")
      .trim(),
    "",
    `${params.ctaLabel}: ${params.ctaLink}`,
    "",
    params.footerText
  ].join("\n");

  return { html, text };
}

export async function sendEmail({
  to,
  subject,
  html,
  text
}: SendEmailParams) {
  try {
    const resend = getResendClient();

    if (!resend) {
      return {
        success: false,
        error: "Resend is not configured."
      };
    }

    await resend.emails.send({
      from: getResendFromEmail(),
      to,
      subject,
      html,
      text
    });

    return { success: true };
  } catch (error) {
    console.error("Failed to send email.", error);
    return {
      success: false,
      error: "Failed to send email."
    };
  }
}

export async function sendPasswordResetEmail(to: string, resetLink: string) {
  const template = buildEmailTemplate({
    title: "Reset your Ghost ProtoClaw password",
    bodyHtml:
      "<p>You requested a password reset for your Ghost ProtoClaw Mission Control account.</p><p>This one-time link expires in 30 minutes.</p>",
    ctaLabel: "Reset Password",
    ctaLink: resetLink,
    footerText:
      "If you did not request this, you can safely ignore this email."
  });

  return sendEmail({
    to,
    subject: "Reset your Ghost ProtoClaw password",
    html: template.html,
    text: template.text
  });
}

export async function sendInviteEmail(
  to: string,
  inviteLink: string,
  invitedBy: string
) {
  const template = buildEmailTemplate({
    title: "You've been invited to Ghost ProtoClaw Mission Control",
    bodyHtml: `<p>${invitedBy} invited you to join Ghost ProtoClaw Mission Control.</p><p>Use the secure link below to accept the invitation and set your password.</p>`,
    ctaLabel: "Accept Invitation",
    ctaLink: inviteLink,
    footerText:
      "This invitation link is one-time use. If you were not expecting it, contact your administrator."
  });

  return sendEmail({
    to,
    subject: "You've been invited to Ghost ProtoClaw Mission Control",
    html: template.html,
    text: template.text
  });
}

export async function sendMagicLoginEmail(to: string, loginLink: string) {
  const template = buildEmailTemplate({
    title: "Your Ghost ProtoClaw login link",
    bodyHtml:
      "<p>Use this one-time link to sign in to Ghost ProtoClaw Mission Control.</p><p>For your security, it expires in 30 minutes.</p>",
    ctaLabel: "Sign In Now",
    ctaLink: loginLink,
    footerText:
      "If you did not request this login link, no action is needed."
  });

  return sendEmail({
    to,
    subject: "Your Ghost ProtoClaw login link",
    html: template.html,
    text: template.text
  });
}
