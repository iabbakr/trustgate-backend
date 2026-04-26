module.exports = {
  // Cache keys (prefix with tg: for namespace isolation)
  CACHE_KEYS: {
    userProfile: (uid) => `tg:user:${uid}`,
    deviceImei: (imei) => `tg:device:imei:${imei}`,
    deviceSerial: (serial) => `tg:device:serial:${serial}`,
    groups: (uid) => `tg:groups:${uid}`,
    groupPosts: (groupId, page) => `tg:group:${groupId}:posts:p${page}`,
    nearbyUsers: (area) => `tg:nearby:${area}`,
    referralCode: (code) => `tg:referral:${code}`,
    bannedNin: (nin) => `tg:banned:nin:${nin}`,
    bannedBvn: (bvn) => `tg:banned:bvn:${bvn}`,
    paystackPlans: () => "tg:paystack:plans",
    trustScore: (uid) => `tg:trust:${uid}`,
  },

  // Cache TTLs (seconds)
  TTL: {
    USER_PROFILE: parseInt(process.env.CACHE_TTL_USER_PROFILE) || 300,      // 5 min
    DEVICE_CHECK: parseInt(process.env.CACHE_TTL_DEVICE_CHECK) || 600,      // 10 min
    GROUPS: parseInt(process.env.CACHE_TTL_GROUPS) || 120,                  // 2 min
    NEARBY_USERS: 180,                                                        // 3 min
    REFERRAL_CODE: 600,                                                       // 10 min
    BANNED_DOC: 900,                                                          // 15 min
    PAYSTACK_PLANS: 3600,                                                     // 1 hour
    GROUP_POSTS: 60,                                                          // 1 min
  },

  // Trust score boundaries
  TRUST: {
    DEFAULT: 50,
    MAX: 100,
    MIN: 0,
    HIGH_THRESHOLD: 70,
    MID_THRESHOLD: 40,
    BAD_RATING_FLAG_COUNT: 3,
  },

  // Paystack plan codes (match your Paystack dashboard)
  PAYSTACK_PLANS: {
    BASIC: "PLN_basic_monthly",
    PRO: "PLN_pro_monthly",
    ENTERPRISE: "PLN_enterprise_monthly",
  },

  // Notification channels
  NOTIFICATION_TYPES: {
    MESSAGE_REQUEST: "message_request",
    NEW_MESSAGE: "new_message",
    TRANSACTION_UPDATE: "transaction_update",
    KYC_APPROVED: "kyc_approved",
    KYC_REJECTED: "kyc_rejected",
    ACCOUNT_APPROVED: "account_approved",
    ACCOUNT_BANNED: "account_banned",
    ACCOUNT_PARDONED: "account_pardoned",
    NEW_FOLLOWER: "new_follower",
    THEFT_ALERT: "theft_alert",
    PAYMENT_SUCCESS: "payment_success",
  },

  // Firestore collections
  COLLECTIONS: {
    USERS: "users",
    DEVICES: "devices",
    TRANSACTIONS: "transactions",
    CONVERSATIONS: "conversations",
    MESSAGES: "messages",
    GROUPS: "groups",
    GROUP_POSTS: "posts",
    FOLLOWS: "follows",
    RATINGS: "ratings",
    NOTIFICATIONS: "notifications",
    BANNED_NIN: "bannedNIN",
    BANNED_BVN: "bannedBVN",
    PUSH_TOKENS: "pushTokens",
    PAYMENTS: "payments",
    KYC_REQUESTS: "kycRequests",
  },
};
