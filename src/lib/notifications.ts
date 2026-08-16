/**
 * Notification helpers — Email (Resend preferred, else SMTP) + SMS (httpSMS)
 */

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ success: boolean; error?: string }> {
  const resendKey = process.env.RESEND_API_KEY;
  const from =
    process.env.SMTP_FROM ||
    process.env.MAIL_FROM ||
    process.env.RESEND_FROM ||
    "GEEZ <onboarding@resend.dev>";

  // Prefer Resend on Vercel (avoids Gmail 535 BadCredentials)
  if (resendKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [to],
          subject,
          html,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        console.error("[Email] Resend error", text);
        return { success: false, error: text.slice(0, 200) };
      }
      return { success: true };
    } catch (err) {
      console.error("[Email] Resend exception", err);
      return {
        success: false,
        error: err instanceof Error ? err.message : "Resend failed",
      };
    }
  }

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = (process.env.SMTP_PASS || "").replace(/\s/g, "");

  if (!host || !user || !pass) {
    console.error("[Email] No RESEND_API_KEY and SMTP not configured");
    return {
      success: false,
      error:
        "Email not configured. Set RESEND_API_KEY (recommended) or SMTP_* on Vercel.",
    };
  }

  try {
    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.MAIL_FROM || user,
      to,
      subject,
      html,
    });
    return { success: true };
  } catch (err) {
    console.error("[Email] SMTP failed", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Email failed",
    };
  }
}

export async function sendSMS({
  to,
  content,
}: {
  to: string;
  content: string;
}): Promise<{ success: boolean }> {
  const apiKey = process.env.HTTPSMS_API_KEY;
  const from = process.env.HTTPSMS_FROM_NUMBER || process.env.HTTPSMS_FROM;

  if (!apiKey || !from) {
    console.warn("httpSMS not configured");
    return { success: false };
  }

  try {
    const res = await fetch("https://api.httpsms.com/v1/messages/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({ content, from, to }),
    });

    if (!res.ok) {
      console.error("httpSMS error:", await res.text());
      return { success: false };
    }
    return { success: true };
  } catch (err) {
    console.error("httpSMS exception:", err);
    return { success: false };
  }
}

export function generateConfirmationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
