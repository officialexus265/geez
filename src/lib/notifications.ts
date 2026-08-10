/**
 * Notification helpers — Email (SMTP) + SMS (httpSMS)
 */

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  // Will use nodemailer with user's SMTP credentials
  // Placeholder for now — implement with actual SMTP in Phase 7
  console.log("[Email]", { to, subject });
  return { success: true };
}

export async function sendSMS({
  to,
  content,
}: {
  to: string;
  content: string;
}) {
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
      body: JSON.stringify({
        content,
        from,
        to,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("httpSMS error:", text);
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
