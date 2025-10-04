// Import dynamique pour éviter l'exigence de types si nodemailer n'est pas installé en dev
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SentInfo = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Transporter<T = SentInfo> = { sendMail: (opts: any) => Promise<T> } | null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _nodemailer: any | null = null;
try { _nodemailer = require("nodemailer"); } catch { _nodemailer = null; }
import { getEventBySlug } from "@/data/events";

function getTransport(): Transporter | null {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !port || !user || !pass) {
    return null;
  }
  const secure = port === 465; // TLS implicite sur 465
  if (!_nodemailer?.createTransport) return null;
  return _nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
}

function getFromHeader(): string {
  const addr = process.env.MAIL_FROM || process.env.SMTP_USER || "notification@bypass.com";
  const name = process.env.MAIL_FROM_NAME?.trim();
  return name ? `${JSON.stringify(name)} <${addr}>` : addr;
}

function getReplyToHeader(): string | undefined {
  const rt = process.env.MAIL_REPLY_TO?.trim();
  return rt || undefined;
}

function getAppUrl(): string {
  const app = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return app.replace(/\/$/, "");
}

function absolutizeUrl(u?: string | null): string | undefined {
  if (!u) return undefined;
  if (/^https?:\/\//i.test(u)) return u;
  if (u.startsWith('/')) return `${getAppUrl()}${u}`;
  return u;
}

export async function sendJoinAcceptedEmail(params: {
  to: string;
  eventSlug: string;
  groupName: string;
}) {
  const from = getFromHeader();
  const replyTo = getReplyToHeader();
  const transporter = getTransport();
  const event = getEventBySlug(params.eventSlug);
  const title = event?.title || params.eventSlug;
  const subject = `Votre demande a été acceptée — ${params.groupName} — ${title}`;
  const plain = [
    `Bonne nouvelle !`,
    ``,
    `Votre demande pour rejoindre le groupe "${params.groupName}" sur l'événement "${title}" a été acceptée.`,
    `Vous pouvez générer votre QR d'entrée depuis l'application (onglet Scan).`,
  ].join("\n");
  const html = renderBrandedEmail({
    preheader: `Demande acceptée pour ${params.groupName} — ${title}`,
    heading: "Demande acceptée",
    paragraphs: [
      `Votre demande pour rejoindre le groupe <strong>${escapeHtml(params.groupName)}</strong> sur l'événement <strong>${escapeHtml(title)}</strong> a été acceptée.`,
      `Vous pouvez générer votre QR d'entrée depuis l'application (onglet <strong>Scan</strong>).`,
    ],
    accent: "#10b981",
    cta: {
      label: "Afficher mon QR",
      url: `${getAppUrl()}/qr/${params.eventSlug}/${encodeURIComponent(params.groupName)}`,
    },
    image: { src: absolutizeUrl(event?.imageUrl), alt: title },
  });

  if (!transporter) {
    // Pas de config SMTP: log et sortir sans échec
    console.log("[mail] dry-run send", { kind: "member-accepted", to: params.to, from, subject });
    return { ok: false, reason: "smtp-not-configured" as const };
  }
  try {
    console.log("[mail] sending", { kind: "member-accepted", to: params.to, from, subject });
  const info = await transporter.sendMail({ from, to: params.to, subject, text: plain, html, replyTo });
    try {
      console.log("[mail] sent", {
        kind: "member-accepted",
        to: params.to,
        messageId: info?.messageId,
        accepted: info?.accepted,
        rejected: info?.rejected,
        response: info?.response,
      });
    } catch {}
    return { ok: true as const };
  } catch (e) {
    console.error("[mail] send failed", e);
    return { ok: false, reason: "send-failed" as const };
  }
}

export async function sendOwnerNotifiedAcceptedEmail(params: {
  to: string; // owner email
  eventSlug: string;
  groupName: string;
  memberEmail: string;
}) {
  const from = getFromHeader();
  const replyTo = getReplyToHeader();
  const transporter = getTransport();
  const event = getEventBySlug(params.eventSlug);
  const title = event?.title || params.eventSlug;
  const subject = `Nouveau membre accepté — ${params.groupName} — ${title}`;
  const memberPretty = prettyEmail(params.memberEmail);
  const plain = [
    `Bonjour,`,
    ``,
    `${memberPretty} a été accepté(e) dans votre groupe "${params.groupName}" pour l'événement "${title}".`,
  ].join("\n");
  const html = renderBrandedEmail({
    preheader: `Nouveau membre accepté — ${memberPretty}`,
    heading: "Nouveau membre accepté",
    paragraphs: [
      `${escapeHtml(memberPretty)} a été accepté(e) dans votre groupe <strong>${escapeHtml(params.groupName)}</strong> pour l'événement <strong>${escapeHtml(title)}</strong>.`,
    ],
    accent: "#10b981",
    cta: {
      label: "Voir les demandes",
      url: `${getAppUrl()}/events/${params.eventSlug}/requests`,
    },
  image: { src: absolutizeUrl(event?.imageUrl), alt: title },
  });
  if (!transporter) {
    console.log("[mail] dry-run send", { kind: "owner-notify-accepted", to: params.to, from, subject });
    return { ok: false as const, reason: "smtp-not-configured" as const };
  }
  try {
    console.log("[mail] sending", { kind: "owner-notify-accepted", to: params.to, from, subject });
  const info = await transporter.sendMail({ from, to: params.to, subject, text: plain, html, replyTo });
    try {
      console.log("[mail] sent", {
        kind: "owner-notify-accepted",
        to: params.to,
        messageId: info?.messageId,
        accepted: info?.accepted,
        rejected: info?.rejected,
        response: info?.response,
      });
    } catch {}
    return { ok: true as const };
  } catch (e) {
    console.error("[mail] send owner failed", e);
    return { ok: false as const, reason: "send-failed" as const };
  }
}

export async function sendNewMessageEmail(params: {
  to: string;
  eventSlug: string;
  groupName: string;
  conversationId: number | string;
  senderEmail: string;
  senderName?: string | null;
  content: string;
}) {
  const from = getFromHeader();
  const replyTo = getReplyToHeader();
  const transporter = getTransport();
  const event = getEventBySlug(params.eventSlug);
  const title = event?.title || params.eventSlug;
  const senderPretty = (params.senderName && params.senderName.trim()) || prettyEmail(params.senderEmail);
  const subject = `Nouveau message — ${params.groupName} — ${title}`;
  const excerpt = String(params.content || "").replace(/\s+/g, " ").trim().slice(0, 180);
  const plain = [
    `${senderPretty} vous a envoyé un message dans "${params.groupName}" (${title}).`,
    "",
    excerpt ? `“${excerpt}”` : "",
    "",
    `Ouvrir: ${getAppUrl()}/messages/${params.conversationId}`,
  ].join("\n");
  const html = renderBrandedEmail({
  preheader: `Nouveau message de ${senderPretty} — ${title}`,
    heading: "Nouveau message",
    paragraphs: [
      `${escapeHtml(senderPretty)} vous a envoyé un message dans <strong>${escapeHtml(params.groupName)}</strong> pour l'événement <strong>${escapeHtml(title)}</strong>.`,
      excerpt ? `<em style="color:#cbd5e1">“${escapeHtml(excerpt)}”</em>` : "",
    ].filter(Boolean) as string[],
    accent: "#6366f1",
    cta: {
      label: "Ouvrir la conversation",
      url: `${getAppUrl()}/messages/${params.conversationId}`,
    },
    image: { src: absolutizeUrl(event?.imageUrl), alt: title },
  });

  if (!transporter) {
    console.log("[mail] dry-run send", { kind: "message", to: params.to, from, subject });
    return { ok: false as const, reason: "smtp-not-configured" as const };
  }
  try {
    console.log("[mail] sending", { kind: "message", to: params.to, from, subject });
    const info = await transporter.sendMail({ from, to: params.to, subject, text: plain, html, replyTo });
    try {
      console.log("[mail] sent", {
        kind: "message",
        to: params.to,
        messageId: info?.messageId,
        accepted: info?.accepted,
        rejected: info?.rejected,
        response: info?.response,
      });
    } catch {}
    return { ok: true as const };
  } catch (e) {
    console.error("[mail] send message failed", e);
    return { ok: false as const, reason: "send-failed" as const };
  }
}

export async function sendOwnerJoinRequestedEmail(params: {
  to: string; // owner email
  eventSlug: string;
  groupName: string;
  applicantEmail: string;
  applicantName?: string | null;
  amountCents?: number | null;
  currency?: string | null; // ex: EUR
}) {
  const from = getFromHeader();
  const replyTo = getReplyToHeader();
  const transporter = getTransport();
  const event = getEventBySlug(params.eventSlug);
  const title = event?.title || params.eventSlug;
  const applicant = (params.applicantName && params.applicantName.trim()) || prettyEmail(params.applicantEmail);
  const amount = typeof params.amountCents === "number" && params.amountCents >= 0
    ? `${(params.amountCents / 100).toFixed(2)} ${params.currency || "EUR"}`
    : undefined;
  const subject = `Nouvelle demande — ${params.groupName} — ${title}`;
  const plain = [
    `${applicant} a demandé à rejoindre votre groupe "${params.groupName}" (${title}).`,
    amount ? `Proposition de paiement: ${amount}` : "",
    "",
    `Gérer les demandes: ${getAppUrl()}/events/${params.eventSlug}/requests`,
  ].join("\n");
  const html = renderBrandedEmail({
    preheader: `Demande reçue — ${applicant}`,
    heading: "Nouvelle demande de groupe",
    paragraphs: [
      `${escapeHtml(applicant)} souhaite rejoindre votre groupe <strong>${escapeHtml(params.groupName)}</strong> pour l'événement <strong>${escapeHtml(title)}</strong>.`,
      amount ? `Proposition de paiement: <strong>${escapeHtml(amount)}</strong>` : "",
    ].filter(Boolean) as string[],
    accent: "#f59e0b",
    cta: {
      label: "Gérer les demandes",
      url: `${getAppUrl()}/events/${params.eventSlug}/requests`,
    },
    image: { src: absolutizeUrl(event?.imageUrl), alt: title },
  });

  if (!transporter) {
    console.log("[mail] dry-run send", { kind: "join-requested", to: params.to, from, subject });
    return { ok: false as const, reason: "smtp-not-configured" as const };
  }
  try {
    console.log("[mail] sending", { kind: "join-requested", to: params.to, from, subject });
    const info = await transporter.sendMail({ from, to: params.to, subject, text: plain, html, replyTo });
    try {
      console.log("[mail] sent", {
        kind: "join-requested",
        to: params.to,
        messageId: info?.messageId,
        accepted: info?.accepted,
        rejected: info?.rejected,
        response: info?.response,
      });
    } catch {}
    return { ok: true as const };
  } catch (e) {
    console.error("[mail] send join-requested failed", e);
    return { ok: false as const, reason: "send-failed" as const };
  }
}

export async function sendMemberScannedEmail(params: {
  to: string; // member email
  eventSlug: string;
  groupName: string;
  ownerName?: string | null;
}) {
  const from = getFromHeader();
  const replyTo = getReplyToHeader();
  const transporter = getTransport();
  const event = getEventBySlug(params.eventSlug);
  const title = event?.title || params.eventSlug;
  const subject = `Votre QR a été scanné — ${params.groupName} — ${title}`;
  const who = params.ownerName || "l'organisatrice";
  const plain = [
    `Votre QR code a été scanné par ${who}.`,
    `Groupe: ${params.groupName} — Événement: ${title}.`,
  ].join("\n");
  const html = renderBrandedEmail({
    preheader: `QR scanné — ${params.groupName}`,
    heading: "Entrée validée",
    paragraphs: [
      `Votre QR code a été scanné par <strong>${escapeHtml(who)}</strong>.`,
      `Groupe: <strong>${escapeHtml(params.groupName)}</strong> — Événement: <strong>${escapeHtml(title)}</strong>.`,
    ],
    accent: "#10b981",
  });
  if (!transporter) {
    console.log("[mail] dry-run send", { kind: "member-scanned", to: params.to, from, subject });
    return { ok: false as const, reason: "smtp-not-configured" as const };
  }
  try {
    console.log("[mail] sending", { kind: "member-scanned", to: params.to, from, subject });
    const info = await transporter.sendMail({ from, to: params.to, subject, text: plain, html, replyTo });
    try { console.log("[mail] sent", { kind: "member-scanned", to: params.to, messageId: info?.messageId, accepted: info?.accepted, rejected: info?.rejected, response: info?.response }); } catch {}
    return { ok: true as const };
  } catch (e) {
    console.error("[mail] send member-scanned failed", e);
    return { ok: false as const, reason: "send-failed" as const };
  }
}

export async function sendOwnerScannedEmail(params: {
  to: string; // owner email
  eventSlug: string;
  groupName: string;
  memberEmail: string;
  memberName?: string | null;
  amountCents?: number | null;
  currency?: string | null;
}) {
  const from = getFromHeader();
  const replyTo = getReplyToHeader();
  const transporter = getTransport();
  const event = getEventBySlug(params.eventSlug);
  const title = event?.title || params.eventSlug;
  const who = (params.memberName && params.memberName.trim()) || prettyEmail(params.memberEmail);
  const amount = typeof params.amountCents === "number" && params.amountCents >= 0
    ? `${(params.amountCents / 100).toFixed(2)} ${params.currency || "EUR"}`
    : undefined;
  const subject = `Scan confirmé — ${params.groupName} — ${title}`;
  const plain = [
    `Vous venez de scanner ${who}.`,
    amount ? `Montant crédité: ${amount}` : `Montant crédité: —`,
  ].join("\n");
  const html = renderBrandedEmail({
    preheader: `Scan confirmé — ${who}`,
    heading: "Scan réussi",
    paragraphs: [
      `Vous venez de scanner <strong>${escapeHtml(who)}</strong>.`,
      amount ? `Montant crédité: <strong>${escapeHtml(amount)}</strong>` : `Montant crédité: —`,
    ],
    accent: "#10b981",
    cta: { label: "Voir mes transactions", url: `${getAppUrl()}/profile/transactions` },
  });
  if (!transporter) {
    console.log("[mail] dry-run send", { kind: "owner-scanned", to: params.to, from, subject });
    return { ok: false as const, reason: "smtp-not-configured" as const };
  }
  try {
    console.log("[mail] sending", { kind: "owner-scanned", to: params.to, from, subject });
    const info = await transporter.sendMail({ from, to: params.to, subject, text: plain, html, replyTo });
    try { console.log("[mail] sent", { kind: "owner-scanned", to: params.to, messageId: info?.messageId, accepted: info?.accepted, rejected: info?.rejected, response: info?.response }); } catch {}
    return { ok: true as const };
  } catch (e) {
    console.error("[mail] send owner-scanned failed", e);
    return { ok: false as const, reason: "send-failed" as const };
  }
}

function prettyEmail(email: string) {
  const local = String(email || '').split('@')[0];
  const cleaned = local.replace(/[._-]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!cleaned) return email;
  return cleaned.split(' ').map(w => w ? w.charAt(0).toUpperCase() + w.slice(1) : '').join(' ');
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Template HTML brandé (fond sombre, glassmorphisme) avec styles inline compatibles email
function renderBrandedEmail(opts: {
  preheader?: string;
  heading: string;
  paragraphs: string[];
  accent?: string; // couleur d’accent de la bordure/heading
  cta?: { label: string; url: string };
  image?: { src?: string; alt?: string };
}): string {
  const brandName = process.env.MAIL_FROM_NAME || "Bypass";
  const accent = opts.accent || "#6366f1"; // violet par défaut
  const preheader = (opts.preheader || "").replace(/\n/g, " ");

  const paragraphsHtml = opts.paragraphs
    .map(p => `<p style="margin:0 0 14px;color:#e5e7eb;font-size:14px;line-height:1.7;font-family:Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,Noto Sans,sans-serif">${p}</p>`)
    .join("");

  const ctaHtml = opts.cta ? `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:14px 0 0 0">
      <tr>
        <td>
          <a href="${opts.cta.url}" target="_blank" style="display:inline-block;padding:10px 16px;border-radius:12px;background:${accent};color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;font-family:Inter,Segoe UI,Roboto,Helvetica,Arial,sans-serif;box-shadow:0 6px 20px rgba(16,185,129,0.35)">${escapeHtml(opts.cta.label)}</a>
        </td>
      </tr>
      <tr>
        <td style="padding-top:10px">
          <div style="color:#94a3b8;font-size:12px;font-family:Inter,Segoe UI,Roboto,Helvetica,Arial,sans-serif">Si le bouton ne fonctionne pas, copiez-collez ce lien: <span style="color:#cbd5e1">${escapeHtml(opts.cta.url)}</span></div>
        </td>
      </tr>
    </table>
  ` : "";

  return (
    `<!doctype html>
    <html lang="fr">
    <head>
      <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${escapeHtml(opts.heading)}</title>
      <meta name="color-scheme" content="light"/>
      <meta name="supported-color-schemes" content="light"/>
      ${preheader ? `<span style="display:none !important;opacity:0;visibility:hidden;mso-hide:all;height:0;width:0;overflow:hidden">${escapeHtml(preheader)}</span>` : ""}
    </head>
    <body style="margin:0;padding:0;background:#0b1220;background-image:linear-gradient(180deg,#0b1220 0%,#0f172a 100%);">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:transparent">
        <tr>
          <td align="center" style="padding:24px">
            <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;width:100%">
              <tr>
                <td style="padding:0 0 16px 0;text-align:center">
                  <div style="display:inline-block;padding:10px 14px;border-radius:999px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.18);color:#e2e8f0;font-weight:700;font-family:Inter,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:13px;box-shadow:0 4px 18px rgba(0,0,0,0.3)">${escapeHtml(brandName)}</div>
                </td>
              </tr>
              <tr>
                <td style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.18);border-radius:16px;padding:24px;box-shadow:0 8px 32px rgba(0,0,0,0.35);backdrop-filter:saturate(160%);-webkit-backdrop-filter:saturate(160%);">
                  ${opts.image?.src ? `<img src="${opts.image.src}" alt="${escapeHtml(opts.image.alt || '')}" width="552" style="display:block;width:100%;max-width:552px;height:auto;border-radius:14px;border:1px solid rgba(255,255,255,0.18);margin:0 0 16px 0" />` : ''}
                  <h1 style="margin:0 0 8px 0;color:#ffffff;font-size:20px;line-height:1.35;font-family:Inter,Segoe UI,Roboto,Helvetica,Arial,sans-serif">${escapeHtml(opts.heading)}</h1>
                  <div style="height:3px;background:linear-gradient(90deg,${accent},${accent}80);width:56px;border-radius:2px;margin:8px 0 18px 0"></div>
                  ${paragraphsHtml}
                  ${ctaHtml}
                </td>
              </tr>
              <tr>
                <td style="padding:16px 8px 0 8px;text-align:center">
                  <p style="margin:0;color:#94a3b8;font-size:12px;font-family:Inter,Segoe UI,Roboto,Helvetica,Arial,sans-serif">© ${new Date().getFullYear()} ${escapeHtml(brandName)} — Cet email vous a été envoyé automatiquement.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>`
  );
}
