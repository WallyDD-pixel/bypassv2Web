export type PaypalEnv = "sandbox" | "live";

const getEnv = (): PaypalEnv => {
  const v = process.env.PAYPAL_ENV?.toLowerCase();
  return v === "live" ? "live" : "sandbox";
};

export const paypalBaseUrl = () =>
  getEnv() === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";

export async function getAccessToken() {
  const client = process.env.PAYPAL_CLIENT_ID || process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET || "";
  if (!client || !secret) throw new Error("PayPal credentials missing");
  const res = await fetch(`${paypalBaseUrl()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${client}:${secret}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  if (!res.ok) {
    let detail = "";
    try {
      const t = await res.text();
      detail = t;
    } catch {}
    throw new Error(`OAuth failed (${res.status}). Check PAYPAL_ENV matches credentials. ${detail}`);
  }
  const data = await res.json();
  return data.access_token as string;
}

export async function generateClientToken() {
  const access = await getAccessToken();
  const res = await fetch(`${paypalBaseUrl()}/v1/identity/generate-token`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${access}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    let detail = "";
    try { detail = await res.text(); } catch {}
    throw new Error(`Failed to generate client token (${res.status}). ${detail}`);
  }
  const data = await res.json();
  return data.client_token as string;
}

export async function createOrder(amount: number, description?: string, intent: "CAPTURE" | "AUTHORIZE" = "CAPTURE") {
  const access = await getAccessToken();
  const res = await fetch(`${paypalBaseUrl()}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${access}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
  intent,
      purchase_units: [
        {
          amount: { currency_code: "EUR", value: amount.toFixed(2) },
          description,
        },
      ],
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    let detail = "";
    try { detail = await res.text(); } catch {}
    throw new Error(`Failed to create order (${res.status}). ${detail}`);
  }
  const data = await res.json();
  return data; // returns { id, ... }
}

export async function captureOrder(orderID: string) {
  const access = await getAccessToken();
  const res = await fetch(`${paypalBaseUrl()}/v2/checkout/orders/${orderID}/capture`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${access}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    let detail = "";
    try { detail = await res.text(); } catch {}
    throw new Error(`Failed to capture order (${res.status}). ${detail}`);
  }
  const data = await res.json();
  return data;
}

export async function getOrderDetails(orderID: string) {
  const access = await getAccessToken();
  const res = await fetch(`${paypalBaseUrl()}/v2/checkout/orders/${orderID}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${access}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    let detail = "";
    try { detail = await res.text(); } catch {}
    throw new Error(`Failed to get order (${res.status}). ${detail}`);
  }
  return res.json();
}

export async function captureAuthorization(authorizationID: string) {
  const access = await getAccessToken();
  const res = await fetch(`${paypalBaseUrl()}/v2/payments/authorizations/${authorizationID}/capture`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${access}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    let detail = "";
    try { detail = await res.text(); } catch {}
    throw new Error(`Failed to capture authorization (${res.status}). ${detail}`);
  }
  return res.json();
}

export async function voidAuthorization(authorizationID: string) {
  const access = await getAccessToken();
  const res = await fetch(`${paypalBaseUrl()}/v2/payments/authorizations/${authorizationID}/void`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${access}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    let detail = "";
    try { detail = await res.text(); } catch {}
    throw new Error(`Failed to void authorization (${res.status}). ${detail}`);
  }
  return { ok: true };
}
