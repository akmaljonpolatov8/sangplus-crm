export type SmsSendResult = {
  ok: boolean;
  provider: "mock" | "twilio" | "eskiz" | "playmobile" | "generic";
  externalId?: string;
  error?: string;
};

type SmsProvider = "twilio" | "eskiz" | "playmobile" | "generic";

function normalizePhone(phone: string): string {
  return phone.replace(/\s+/g, "").trim();
}

export async function sendSmsMessage(
  to: string,
  message: string,
): Promise<SmsSendResult> {
  const normalizedTo = normalizePhone(to);
  if (!normalizedTo) {
    return {
      ok: false,
      provider: "mock",
      error: "Empty phone number",
    };
  }

  const provider = (
    process.env.SMS_PROVIDER || "generic"
  ).toLowerCase() as SmsProvider;
  const endpoint = process.env.SMS_API_URL;
  const apiKey = process.env.SMS_API_KEY;
  const sender = process.env.SMS_SENDER || "SangPlus";

  // If provider credentials are not configured, safely fall back to mock mode.
  if (!apiKey && provider !== "twilio") {
    console.log("[SMS:MOCK]", { provider, to: normalizedTo, message });
    return {
      ok: true,
      provider: "mock",
      externalId: `mock-${Date.now()}`,
    };
  }

  if (!endpoint && provider !== "twilio") {
    console.log("[SMS:MOCK]", { to: normalizedTo, message });
    return {
      ok: true,
      provider: "mock",
      externalId: `mock-${Date.now()}`,
    };
  }

  try {
    let response: Response;

    if (provider === "twilio") {
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const from = process.env.TWILIO_FROM;

      if (!accountSid || !authToken || !from) {
        console.log("[SMS:MOCK]", { provider, to: normalizedTo, message });
        return {
          ok: true,
          provider: "mock",
          externalId: `mock-${Date.now()}`,
        };
      }

      const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
      const body = new URLSearchParams({
        To: normalizedTo,
        From: from,
        Body: message,
      });

      response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${auth}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: body.toString(),
        },
      );
    } else if (provider === "eskiz") {
      response = await fetch(endpoint!, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          mobile_phone: normalizedTo,
          message,
          from: sender,
        }),
      });
    } else if (provider === "playmobile") {
      response = await fetch(endpoint!, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          messages: [
            {
              recipient: normalizedTo,
              "message-id": `msg-${Date.now()}`,
              sms: {
                originator: sender,
                content: { text: message },
              },
            },
          ],
        }),
      });
    } else {
      response = await fetch(endpoint!, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          to: normalizedTo,
          message,
          from: sender,
        }),
      });
    }

    if (!response.ok) {
      const bodyText = await response.text().catch(() => "");
      return {
        ok: false,
        provider,
        error: `SMS provider error (${response.status}) ${bodyText}`.trim(),
      };
    }

    const data = (await response.json().catch(() => ({}))) as {
      id?: string;
      messageId?: string;
      sid?: string;
      data?: { id?: string };
    };

    return {
      ok: true,
      provider,
      externalId:
        data.id || data.messageId || data.sid || data.data?.id || undefined,
    };
  } catch (error) {
    return {
      ok: false,
      provider,
      error: error instanceof Error ? error.message : "Unknown SMS error",
    };
  }
}
