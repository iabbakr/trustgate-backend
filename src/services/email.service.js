/**
 * email.service.js
 *
 * All transactional emails go through Resend.
 * Templates are inline HTML — move to React Email for scale.
 *
 * Best practice: never call these directly from controllers.
 * Use enqueueEmail() from jobs/email.job.js so failures are retried
 * and the request doesn't block on email delivery.
 */

const { resend, FROM, REPLY_TO } = require("../config/resend");
const logger = require("../utils/logger");

async function sendEmail({ to, subject, html }) {
  try {
    const result = await resend.emails.send({
      from: FROM,
      replyTo: REPLY_TO,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
    });
    logger.info(`Email sent to ${to}: ${subject}`);
    return result;
  } catch (err) {
    logger.error(`Email failed to ${to}: ${err.message}`);
    throw err;
  }
}

function welcomeEmail(user) {
  return sendEmail({
    to: user.email,
    subject: "Welcome to TrustGate — Your Account is Pending Review",
    html: `
      <div style="font-family:Inter,sans-serif;max-width:600px;margin:auto;padding:32px;background:#f8fafc;">
        <div style="background:#1e40af;padding:24px;border-radius:12px 12px 0 0;text-align:center;">
          <h1 style="color:#fff;margin:0;font-size:24px;">🛡️ TrustGate</h1>
        </div>
        <div style="background:#fff;padding:32px;border-radius:0 0 12px 12px;">
          <h2 style="color:#1e293b;">Welcome, ${user.displayName}!</h2>
          <p style="color:#64748b;line-height:1.6;">
            Thank you for joining TrustGate — Nigeria's trusted electronics dealer network.
          </p>
          <p style="color:#64748b;line-height:1.6;">
            Your account is pending admin approval. You'll receive an email once your account is activated (usually within 24 hours).
          </p>
          <div style="background:#dbeafe;padding:16px;border-radius:8px;margin:20px 0;">
            <p style="color:#1e40af;margin:0;font-size:14px;">
              📋 Next step: Open the app and complete your KYC verification to get a verified badge and full access.
            </p>
          </div>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">
          <p style="color:#94a3b8;font-size:12px;">
            TrustGate Legal Partners — Protected under Nigerian Contract Law
          </p>
        </div>
      </div>
    `,
  });
}

function accountApprovedEmail(user) {
  return sendEmail({
    to: user.email,
    subject: "✅ Your TrustGate Account Has Been Approved",
    html: `
      <div style="font-family:Inter,sans-serif;max-width:600px;margin:auto;padding:32px;background:#f8fafc;">
        <div style="background:#16a34a;padding:24px;border-radius:12px 12px 0 0;text-align:center;">
          <h1 style="color:#fff;margin:0;">Account Approved!</h1>
        </div>
        <div style="background:#fff;padding:32px;border-radius:0 0 12px 12px;">
          <h2 style="color:#1e293b;">Great news, ${user.displayName}!</h2>
          <p style="color:#64748b;">Your TrustGate account has been reviewed and approved. You can now access all features.</p>
          <div style="text-align:center;margin:28px 0;">
            <a href="${process.env.API_BASE_URL}" style="background:#1e40af;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;">Open App</a>
          </div>
          <p style="color:#94a3b8;font-size:12px;text-align:center;">
            Complete your KYC verification to unlock your verified badge and increase your Trust Score.
          </p>
        </div>
      </div>
    `,
  });
}

function kycApprovedEmail(user) {
  return sendEmail({
    to: user.email,
    subject: "🛡️ KYC Verification Approved — You're Now Verified",
    html: `
      <div style="font-family:Inter,sans-serif;max-width:600px;margin:auto;padding:32px;background:#f8fafc;">
        <div style="background:#1e40af;padding:24px;border-radius:12px 12px 0 0;text-align:center;">
          <h1 style="color:#fff;margin:0;">KYC Verified ✅</h1>
        </div>
        <div style="background:#fff;padding:32px;border-radius:0 0 12px 12px;">
          <h2 style="color:#1e293b;">Congratulations, ${user.displayName}!</h2>
          <p style="color:#64748b;">Your identity has been successfully verified. You now have a <strong>Verified</strong> badge on your profile and your Trust Score has increased by 20 points.</p>
          <div style="background:#dcfce7;padding:16px;border-radius:8px;margin:20px 0;">
            <p style="color:#16a34a;margin:0;font-size:14px;">🎉 You can now access all TrustGate features including device assignment and advanced dealer tools.</p>
          </div>
        </div>
      </div>
    `,
  });
}

function kycRejectedEmail(user, reason) {
  return sendEmail({
    to: user.email,
    subject: "KYC Verification Update — Action Required",
    html: `
      <div style="font-family:Inter,sans-serif;max-width:600px;margin:auto;padding:32px;background:#f8fafc;">
        <div style="background:#dc2626;padding:24px;border-radius:12px 12px 0 0;text-align:center;">
          <h1 style="color:#fff;margin:0;">KYC Verification Update</h1>
        </div>
        <div style="background:#fff;padding:32px;border-radius:0 0 12px 12px;">
          <p style="color:#64748b;">Hi ${user.displayName}, your KYC submission requires attention.</p>
          ${reason ? `<div style="background:#fef2f2;padding:16px;border-radius:8px;border:1px solid #fca5a5;"><p style="color:#dc2626;margin:0;"><strong>Reason:</strong> ${reason}</p></div>` : ""}
          <p style="color:#64748b;margin-top:16px;">Please re-submit with accurate information via the app. Ensure your documents are clear and match the information provided.</p>
          <div style="text-align:center;margin:24px 0;">
            <a href="${process.env.API_BASE_URL}" style="background:#1e40af;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;">Re-submit KYC</a>
          </div>
        </div>
      </div>
    `,
  });
}

function accountBannedEmail(user) {
  return sendEmail({
    to: user.email,
    subject: "TrustGate Account Action — Important Notice",
    html: `
      <div style="font-family:Inter,sans-serif;max-width:600px;margin:auto;padding:32px;background:#f8fafc;">
        <div style="background:#1e293b;padding:24px;border-radius:12px 12px 0 0;text-align:center;">
          <h1 style="color:#fff;margin:0;font-size:20px;">Account Action Notice</h1>
        </div>
        <div style="background:#fff;padding:32px;border-radius:0 0 12px 12px;">
          <p style="color:#1e293b;">Hi ${user.displayName},</p>
          <p style="color:#64748b;">Your TrustGate account has been permanently banned due to violations of our Terms of Service under Nigerian law.</p>
          <p style="color:#64748b;">If you believe this is an error, contact <a href="mailto:support@trustgate.ng" style="color:#1e40af;">support@trustgate.ng</a> within 14 days.</p>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">
          <p style="color:#94a3b8;font-size:12px;">TrustGate Legal Partners — This action is backed by Nigerian Contract Law.</p>
        </div>
      </div>
    `,
  });
}

function transactionAssignedEmail(owner, collector, tx) {
  return sendEmail({
    to: collector.email,
    subject: `📦 Device Assigned to You — ${tx.deviceBrand} ${tx.deviceModel}`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:600px;margin:auto;padding:32px;background:#f8fafc;">
        <div style="background:#1e40af;padding:24px;border-radius:12px 12px 0 0;text-align:center;">
          <h1 style="color:#fff;margin:0;">Device Assigned to You</h1>
        </div>
        <div style="background:#fff;padding:32px;border-radius:0 0 12px 12px;">
          <p style="color:#64748b;">Hi ${collector.displayName},</p>
          <p style="color:#64748b;"><strong>${owner.displayName}</strong> (${owner.shopName}) has assigned a device to you:</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;">
            <tr style="background:#f8fafc;">
              <td style="padding:10px 12px;border:1px solid #e2e8f0;font-weight:600;color:#1e293b;">Device</td>
              <td style="padding:10px 12px;border:1px solid #e2e8f0;color:#64748b;">${tx.deviceBrand} ${tx.deviceModel}</td>
            </tr>
            <tr>
              <td style="padding:10px 12px;border:1px solid #e2e8f0;font-weight:600;color:#1e293b;">IMEI</td>
              <td style="padding:10px 12px;border:1px solid #e2e8f0;color:#64748b;">${tx.deviceImei}</td>
            </tr>
            <tr style="background:#f8fafc;">
              <td style="padding:10px 12px;border:1px solid #e2e8f0;font-weight:600;color:#1e293b;">Assigned Price</td>
              <td style="padding:10px 12px;border:1px solid #e2e8f0;color:#64748b;">₦${(tx.assignedPrice || 0).toLocaleString()}</td>
            </tr>
          </table>
          <div style="background:#fef2f2;padding:16px;border-radius:8px;border:1px solid #fca5a5;margin-top:20px;">
            <p style="color:#991b1b;margin:0;font-size:13px;line-height:1.6;">⚠️ <strong>Legal Notice:</strong> By accepting this device, you are bound by the TrustGate Dealer Agreement under Nigerian Contract Law. Failure to return or remit payment makes you liable for 150% of the device value.</p>
          </div>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">
          <p style="color:#94a3b8;font-size:12px;">Open the TrustGate app to confirm receipt of this device.</p>
        </div>
      </div>
    `,
  });
}

function theftAlertEmail(reporterUser, device) {
  return sendEmail({
    to: reporterUser.email,
    subject: "🚨 Theft Report Submitted — TrustGate",
    html: `
      <div style="font-family:Inter,sans-serif;max-width:600px;margin:auto;padding:32px;background:#f8fafc;">
        <div style="background:#dc2626;padding:24px;border-radius:12px 12px 0 0;text-align:center;">
          <h1 style="color:#fff;margin:0;">Theft Report Submitted</h1>
        </div>
        <div style="background:#fff;padding:32px;border-radius:0 0 12px 12px;">
          <p style="color:#64748b;">Hi ${reporterUser.displayName},</p>
          <p style="color:#64748b;">Your theft report for <strong>${device.brand} ${device.model}</strong> (IMEI: ${device.imei || "N/A"}) has been submitted and logged on TrustGate.</p>
          <div style="background:#fef2f2;padding:16px;border-radius:8px;border:1px solid #fca5a5;">
            <p style="color:#991b1b;margin:0;font-size:13px;">Other verified dealers will be alerted when checking this device. We strongly recommend also filing a formal police report.</p>
          </div>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">
          <p style="color:#94a3b8;font-size:12px;">If this report was submitted in error, contact support@trustgate.ng immediately.</p>
        </div>
      </div>
    `,
  });
}

module.exports = {
  sendEmail,
  welcomeEmail,
  accountApprovedEmail,
  kycApprovedEmail,
  kycRejectedEmail,
  accountBannedEmail,
  transactionAssignedEmail,
  theftAlertEmail,
};