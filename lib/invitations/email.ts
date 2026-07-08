import "server-only";

type InvitationEmailResult =
  | { status: "failed"; error: string }
  | { status: "sent"; error: null }
  | { status: "skipped"; error: string };

export async function sendInvitationEmail(input: {
  inviteLink: string;
  to: string;
}): Promise<InvitationEmailResult> {
  const webhookUrl = process.env.INVITE_EMAIL_WEBHOOK_URL;

  if (!webhookUrl) {
    return {
      status: "skipped",
      error: "INVITE_EMAIL_WEBHOOK_URL ist nicht konfiguriert.",
    };
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const secret = process.env.INVITE_EMAIL_WEBHOOK_SECRET;

  if (secret) {
    headers.Authorization = `Bearer ${secret}`;
  }

  try {
    const response = await fetch(webhookUrl, {
      body: JSON.stringify({
        inviteLink: input.inviteLink,
        subject: "Einladung zu ZGB-Maglia-Rosa",
        text: `Du wurdest zu ZGB-Maglia-Rosa eingeladen: ${input.inviteLink}`,
        to: input.to,
      }),
      headers,
      method: "POST",
    });

    if (!response.ok) {
      return {
        status: "failed",
        error: `E-Mail-Webhook antwortete mit HTTP ${response.status}.`,
      };
    }

    return { status: "sent", error: null };
  } catch (error) {
    return {
      status: "failed",
      error:
        error instanceof Error
          ? error.message
          : "E-Mailversand fehlgeschlagen.",
    };
  }
}
