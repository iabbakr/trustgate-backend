const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = process.env.RESEND_FROM_EMAIL || "TrustGate <noreply@trustgate.ng>";
const REPLY_TO = process.env.RESEND_REPLY_TO || "support@trustgate.ng";

module.exports = { resend, FROM, REPLY_TO };
