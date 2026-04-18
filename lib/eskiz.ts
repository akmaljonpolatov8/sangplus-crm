type EskizAuthResponse = {
  data?: {
    token?: string;
  };
  token?: string;
  message?: string;
};

type EskizSmsResponse = {
  message?: string;
  data?: {
    id?: string;
    message_id?: string;
  };
};

type EskizContactResponse = {
  message?: string;
  data?: {
    id?: string;
  };
};

export type EskizSendResult = {
  success: boolean;
  error?: string;
  externalId?: string;
};

let cachedToken: string | null = null;
let tokenFetchedAt = 0;
const TOKEN_TTL_MS = 50 * 60 * 1000;

function normalizeEskizPhone(phone: string): string {
  const digits = phone.replace(/\D+/g, "");

  if (digits.startsWith("998") && digits.length >= 12) {
    return digits;
  }

  if (digits.length === 9) {
    return `998${digits}`;
  }

  if (digits.startsWith("0") && digits.length === 10) {
    return `998${digits.slice(1)}`;
  }

  return digits;
}

function getEskizCredentials() {
  const email = process.env.ESKIZ_EMAIL?.trim();
  const password = process.env.ESKIZ_PASSWORD?.trim();
  const from = process.env.SMS_FROM?.trim() || "4546";

  if (!email || !password) {
    throw new Error("Eskiz credentials are not configured");
  }

  return { email, password, from };
}

export async function getEskizToken(forceRefresh = false): Promise<string> {
  if (
    !forceRefresh &&
    cachedToken &&
    Date.now() - tokenFetchedAt < TOKEN_TTL_MS
  ) {
    return cachedToken;
  }

  const { email, password } = getEskizCredentials();

  const response = await fetch("https://notify.eskiz.uz/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });

  const payload = (await response
    .json()
    .catch(() => ({}))) as EskizAuthResponse;

  if (!response.ok) {
    const message =
      payload?.message || `Eskiz auth failed (${response.status})`;
    throw new Error(message);
  }

  const token = payload?.data?.token || payload?.token;

  if (!token) {
    throw new Error("Eskiz token not found in response");
  }

  cachedToken = token;
  tokenFetchedAt = Date.now();

  return token;
}

async function sendWithToken(
  token: string,
  phone: string,
  message: string,
): Promise<Response> {
  const { from } = getEskizCredentials();

  return fetch("https://notify.eskiz.uz/api/message/sms/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      mobile_phone: normalizeEskizPhone(phone),
      message,
      from,
      callback_url: "",
    }),
    cache: "no-store",
  });
}

export async function sendSMS(
  phone: string,
  message: string,
): Promise<EskizSendResult> {
  try {
    let token = await getEskizToken();
    let response = await sendWithToken(token, phone, message);

    if (response.status === 401) {
      token = await getEskizToken(true);
      response = await sendWithToken(token, phone, message);
    }

    const payload = (await response
      .json()
      .catch(() => ({}))) as EskizSmsResponse;

    if (!response.ok) {
      return {
        success: false,
        error: payload?.message || `Eskiz SMS failed (${response.status})`,
      };
    }

    return {
      success: true,
      externalId: payload?.data?.id || payload?.data?.message_id,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Eskiz SMS error",
    };
  }
}

export async function addEskizContact(
  name: string,
  phone: string,
): Promise<{ success: boolean; error?: string; contactId?: string }> {
  try {
    let token = await getEskizToken();
    let response = await fetch("https://notify.eskiz.uz/api/contact", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name,
        mobile_phone: normalizeEskizPhone(phone),
      }),
      cache: "no-store",
    });

    if (response.status === 401) {
      token = await getEskizToken(true);
      response = await fetch("https://notify.eskiz.uz/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name,
          mobile_phone: normalizeEskizPhone(phone),
        }),
        cache: "no-store",
      });
    }

    const payload = (await response
      .json()
      .catch(() => ({}))) as EskizContactResponse;

    if (!response.ok) {
      return {
        success: false,
        error:
          payload?.message || `Eskiz contact add failed (${response.status})`,
      };
    }

    return {
      success: true,
      contactId: payload?.data?.id,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Eskiz contact error",
    };
  }
}
