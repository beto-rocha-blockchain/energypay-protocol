import { NETWORK_LABEL } from "../lib/stellar-network.js";

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "EnergyPay <noreply@energypay.io>";
const API_KEY = process.env.RESEND_API_KEY;

async function sendEmail({ to, subject, html }) {
  if (!API_KEY) {
    console.log(`[EmailService] No RESEND_API_KEY — skipping email to ${to}: ${subject}`);
    return { skipped: true };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const parsed = (() => { try { return JSON.parse(body); } catch { return null; } })();
    const msg = parsed?.message || body;
    console.warn(`[EmailService] Resend API error ${res.status}: ${msg}`);

    // 403 = unverified domain or recipient outside test-mode allow-list.
    // Treat as skipped so the caller can apply a dev-mode fallback.
    if (res.status === 403) {
      console.warn(
        `[EmailService] Delivery blocked by Resend (403). ` +
        `To send to any recipient, verify your domain at https://resend.com/domains. ` +
        `In the meantime the dev_reset_url fallback will be used.`,
      );
      return { skipped: true, reason: msg };
    }

    return { error: msg };
  }

  return res.json().catch(() => ({}));
}

export async function sendWelcomeEmail({ to, fullName, operatorId, publicKey }) {
  return sendEmail({
    to,
    subject: "EnergyPay — Account Confirmed",
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:monospace;background:#0a0a0f;color:#e2e8f0;padding:32px;max-width:600px;margin:0 auto">
  <div style="border:1px solid #1e293b;border-radius:8px;overflow:hidden">
    <div style="background:linear-gradient(135deg,#6366f1,#3b82f6);padding:24px">
      <div style="font-size:20px;font-weight:700;color:#fff">⚡ EnergyPay</div>
      <div style="font-size:11px;letter-spacing:0.15em;color:rgba(255,255,255,0.7);text-transform:uppercase;margin-top:4px">Clearing & Settlement Infrastructure</div>
    </div>
    <div style="padding:24px;background:#0f172a">
      <p style="font-size:14px;color:#94a3b8;margin:0 0 16px">Settlement identity confirmed</p>
      <h2 style="font-size:22px;color:#f1f5f9;margin:0 0 8px">Welcome, ${fullName}</h2>
      <p style="color:#94a3b8;font-size:13px;margin:0 0 24px">Your institutional operator account has been provisioned on the ${NETWORK_LABEL} settlement network.</p>

      <div style="background:#1e293b;border-radius:6px;padding:16px;margin-bottom:24px">
        <div style="font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#64748b;margin-bottom:12px">Account Details</div>
        <div style="display:flex;justify-content:space-between;margin-bottom:8px">
          <span style="color:#64748b;font-size:12px">Operator ID</span>
          <span style="color:#f1f5f9;font-size:12px">${operatorId}</span>
        </div>
        <div style="display:flex;justify-content:space-between;margin-bottom:8px">
          <span style="color:#64748b;font-size:12px">Email</span>
          <span style="color:#f1f5f9;font-size:12px">${to}</span>
        </div>
        <div style="margin-top:12px">
          <div style="color:#64748b;font-size:12px;margin-bottom:4px">Settlement Address</div>
          <div style="color:#6366f1;font-size:11px;word-break:break-all">${publicKey}</div>
        </div>
      </div>

      <div style="background:#1e293b;border-radius:6px;padding:16px;margin-bottom:24px">
        <div style="font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#64748b;margin-bottom:8px">What's Next</div>
        <ul style="margin:0;padding-left:16px;color:#94a3b8;font-size:13px;line-height:1.8">
          <li>Access your Custody Wallet to view XLM and EPWR balances</li>
          <li>Register bilateral energy contracts in the Contract Registry</li>
          <li>Execute peer-to-peer settlements via the Direct Settlement rail</li>
        </ul>
      </div>

      <p style="color:#475569;font-size:11px;margin:0">This is an automated message from EnergyPay Clearing Infrastructure. If you did not create this account, please ignore this email.</p>
    </div>
  </div>
</body>
</html>`,
  });
}

export async function sendPhoneVerificationCode({ to, fullName, code, phone }) {
  return sendEmail({
    to,
    subject: `EnergyPay — Phone Verification Code: ${code}`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:monospace;background:#0a0a0f;color:#e2e8f0;padding:32px;max-width:600px;margin:0 auto">
  <div style="border:1px solid #1e293b;border-radius:8px;overflow:hidden">
    <div style="background:linear-gradient(135deg,#6366f1,#3b82f6);padding:24px">
      <div style="font-size:20px;font-weight:700;color:#fff">⚡ EnergyPay</div>
      <div style="font-size:11px;letter-spacing:0.15em;color:rgba(255,255,255,0.7);text-transform:uppercase;margin-top:4px">Clearing & Settlement Infrastructure</div>
    </div>
    <div style="padding:24px;background:#0f172a">
      <p style="font-size:14px;color:#94a3b8;margin:0 0 16px">Phone verification for ${phone}</p>
      <h2 style="font-size:22px;color:#f1f5f9;margin:0 0 8px">Hello, ${fullName}</h2>
      <p style="color:#94a3b8;font-size:13px;margin:0 0 24px">Use the code below to verify your phone number on EnergyPay. This code expires in 10 minutes.</p>

      <div style="background:#1e293b;border-radius:8px;padding:24px;text-align:center;margin-bottom:24px">
        <div style="font-size:10px;letter-spacing:0.3em;text-transform:uppercase;color:#64748b;margin-bottom:12px">Verification Code</div>
        <div style="font-size:36px;font-weight:700;letter-spacing:0.4em;color:#6366f1;font-family:monospace">${code}</div>
      </div>

      <p style="color:#475569;font-size:11px;margin:0">If you did not request this code, please ignore this email. Never share this code with anyone.</p>
    </div>
  </div>
</body>
</html>`,
  });
}

export async function sendVerificationEmail({ to, fullName, verificationToken }) {
  const verifyUrl = `${process.env.VITE_API_URL || process.env.BACKEND_URL || "http://localhost:3000"}/api/auth/verify-email?token=${verificationToken}`;
  return sendEmail({
    to,
    subject: "EnergyPay — Verify Your Email",
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:monospace;background:#0a0a0f;color:#e2e8f0;padding:32px;max-width:600px;margin:0 auto">
  <div style="border:1px solid #1e293b;border-radius:8px;overflow:hidden">
    <div style="background:linear-gradient(135deg,#6366f1,#3b82f6);padding:24px">
      <div style="font-size:20px;font-weight:700;color:#fff">⚡ EnergyPay</div>
      <div style="font-size:11px;letter-spacing:0.15em;color:rgba(255,255,255,0.7);text-transform:uppercase;margin-top:4px">Clearing & Settlement Infrastructure</div>
    </div>
    <div style="padding:24px;background:#0f172a">
      <p style="font-size:14px;color:#94a3b8;margin:0 0 16px">Email verification required</p>
      <h2 style="font-size:22px;color:#f1f5f9;margin:0 0 8px">Hello, ${fullName}</h2>
      <p style="color:#94a3b8;font-size:13px;margin:0 0 24px">Please verify your email address to activate your settlement identity on the ${NETWORK_LABEL} network. Verified accounts appear on the Operational Grid and can participate in settlements.</p>

      <a href="${verifyUrl}" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#3b82f6);color:#fff;font-family:monospace;font-size:13px;letter-spacing:0.1em;text-transform:uppercase;text-decoration:none;padding:12px 24px;border-radius:6px;margin-bottom:24px">Verify Email →</a>

      <div style="background:#1e293b;border-radius:6px;padding:12px;margin-bottom:24px">
        <div style="font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#64748b;margin-bottom:6px">Or copy this link</div>
        <div style="color:#6366f1;font-size:11px;word-break:break-all">${verifyUrl}</div>
      </div>

      <p style="color:#475569;font-size:11px;margin:0">If you did not create this account, please ignore this email.</p>
    </div>
  </div>
</body>
</html>`,
  });
}

export async function sendPasswordResetEmail({ to, fullName, resetToken }) {
  const resetUrl = `${process.env.FRONTEND_URL || "http://localhost:8080"}/reset-password?token=${resetToken}`;
  return sendEmail({
    to,
    subject: "EnergyPay — Password Reset Request",
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:monospace;background:#0a0a0f;color:#e2e8f0;padding:32px;max-width:600px;margin:0 auto">
  <div style="border:1px solid #1e293b;border-radius:8px;overflow:hidden">
    <div style="background:linear-gradient(135deg,#6366f1,#3b82f6);padding:24px">
      <div style="font-size:20px;font-weight:700;color:#fff">⚡ EnergyPay</div>
      <div style="font-size:11px;letter-spacing:0.15em;color:rgba(255,255,255,0.7);text-transform:uppercase;margin-top:4px">Clearing & Settlement Infrastructure</div>
    </div>
    <div style="padding:24px;background:#0f172a">
      <p style="font-size:14px;color:#94a3b8;margin:0 0 16px">Password recovery request</p>
      <h2 style="font-size:22px;color:#f1f5f9;margin:0 0 8px">Reset your password</h2>
      <p style="color:#94a3b8;font-size:13px;margin:0 0 24px">Hello ${fullName}, we received a request to reset your EnergyPay operator password. Click the button below to proceed.</p>

      <a href="${resetUrl}" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#3b82f6);color:#fff;font-family:monospace;font-size:13px;letter-spacing:0.1em;text-transform:uppercase;text-decoration:none;padding:12px 24px;border-radius:6px;margin-bottom:24px">Reset Password →</a>

      <div style="background:#1e293b;border-radius:6px;padding:12px;margin-bottom:24px">
        <div style="font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#64748b;margin-bottom:6px">Or copy this link</div>
        <div style="color:#6366f1;font-size:11px;word-break:break-all">${resetUrl}</div>
      </div>

      <p style="color:#475569;font-size:11px;margin:0">This link expires in 1 hour. If you did not request a password reset, you can safely ignore this email — your account remains secure.</p>
    </div>
  </div>
</body>
</html>`,
  });
}
