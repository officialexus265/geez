/**
 * Notification helpers — Email (SMTP via nodemailer) + SMS (httpSMS)
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
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from =
    process.env.SMTP_FROM || user || "noreply@geez.app";

  if (!host || !user || !pass) {
    console.error("[Email] SMTP not configured", { host: !!host, user: !!user });
    return { success: false, error: "SMTP not configured" };
  }

  try {
    // Dynamic import so build works if nodemailer types lag
    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    await transporter.sendMail({
      from,
      to,
      subject,
      html,
    });
    return { success: true };
  } catch (err) {
    console.error("[Email] send failed", err);
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
  const from = process.env.HTTPSMS_FROM_NUMBER;

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
