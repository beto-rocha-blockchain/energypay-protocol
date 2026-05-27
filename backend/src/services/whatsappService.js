/**
 * WhatsApp verification via Twilio API.
 *
 * Required env vars:
 *   TWILIO_ACCOUNT_SID   — Twilio Account SID
 *   TWILIO_AUTH_TOKEN     — Twilio Auth Token
 *   TWILIO_WHATSAPP_FROM  — Twilio WhatsApp sender (e.g. "whatsapp:+14155238886")
 *
 * Uses the Twilio Messages API to send a WhatsApp message with the verification code.
 * If Twilio is not configured, falls back to logging the code to the console.
 */

import twilio from "twilio";

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const FROM = process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886";

const client = ACCOUNT_SID && AUTH_TOKEN ? twilio(ACCOUNT_SID, AUTH_TOKEN) : null;

/**
 * Send a 6-digit verification code via WhatsApp.
 * @param {{ to: string, code: string, fullName: string }} opts
 */
export async function sendWhatsAppVerificationCode({ to, code, fullName }) {
  // Normalize phone to E.164 with whatsapp: prefix
  const cleanPhone = to.replace(/[^\d+]/g, "");
  const whatsappTo = `whatsapp:${cleanPhone.startsWith("+") ? cleanPhone : "+" + cleanPhone}`;

  const body =
    `⚡ *EnergyPay — Phone Verification*\n\n` +
    `Hello, ${fullName}.\n\n` +
    `Your verification code is:\n\n` +
    `*${code}*\n\n` +
    `This code expires in 10 minutes.\n` +
    `If you did not request this, ignore this message.`;

  if (!client) {
    console.log(`[WhatsApp] Twilio not configured — code for ${whatsappTo}: ${code}`);
    return { fallback: true, code };
  }

  try {
    const message = await client.messages.create({
      from: FROM,
      to: whatsappTo,
      body,
    });
    console.log(`[WhatsApp] Verification code sent to ${whatsappTo} — SID: ${message.sid}`);
    return { sid: message.sid };
  } catch (err) {
    console.error(`[WhatsApp] Failed to send to ${whatsappTo}:`, err.message);
    throw err;
  }
}
