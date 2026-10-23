const crypto = require("crypto");
const {
  BakongKHQR,
  khqrData,
  IndividualInfo,
  MerchantInfo,
  SourceInfo,
} = require("bakong-khqr");
const db = require("../config/db");
const config = require("../config/env");

class KhqrService {
  /**
   * Generates a fully compliant Bakong KHQR dynamic payment string
   * verified by NBC / Bakong EMVCo specifications.
   * @param {Object} params
   * @param {string} params.billNumber Unique bill reference
   * @param {number} params.amountUsd Amount in USD
   * @param {string} [params.merchantName] Optional store name
   * @param {string} [params.merchantCity] Optional store city
   */
  static generateDynamicKhqr({
    billNumber,
    amountUsd,
    merchantName,
    merchantCity,
  }) {
    const numericAmount = Math.max(
      0.01,
      parseFloat(Number(amountUsd).toFixed(2)),
    );
    const storeName = String(
      merchantName || config.BAKONG.merchantName || "LOTTO 4U",
    )
      .trim()
      .slice(0, 25);
    const city = String(
      merchantCity || config.BAKONG.merchantCity || "Phnom Penh",
    )
      .trim()
      .slice(0, 15);
    const accountId = String(
      config.BAKONG.accountId || "phearom_moeu@bkrt",
    ).trim();
    const cleanBillNumber = String(billNumber || "")
      .trim()
      .slice(0, 25);

    // 15-minute expiration timestamp for dynamic KHQR (NBC standard)
    const expirationTimestamp = Date.now() + 15 * 60 * 1000;

    const khqr = new BakongKHQR();
    let result;

    if (config.BAKONG.merchantId) {
      const merchantInfo = new MerchantInfo(
        accountId,
        config.BAKONG.merchantId,
        config.BAKONG.acquiringBank || "Bakong",
        storeName,
        city,
        {
          currency: khqrData.currency.usd,
          amount: numericAmount,
          billNumber: cleanBillNumber,
          storeLabel: "KHLOTTO",
          terminalLabel: "ONLINE",
          expirationTimestamp,
        },
      );
      result = khqr.generateMerchant(merchantInfo);
    } else {
      const individualInfo = new IndividualInfo(accountId, storeName, city, {
        currency: khqrData.currency.usd,
        amount: numericAmount,
        billNumber: cleanBillNumber,
        storeLabel: "KHLOTTO",
        terminalLabel: "ONLINE",
        expirationTimestamp,
      });
      result = khqr.generateIndividual(individualInfo);
    }

    if (!result || result.status?.code !== 0 || !result.data?.qr) {
      console.error("[KhqrService] Error generating KHQR:", result?.status);
      throw new Error(
        `Failed to generate compliant Bakong KHQR: ${result?.status?.message || "Unknown error"}`,
      );
    }

    const completeKhqr = result.data.qr;
    const md5Hash =
      result.data.md5 ||
      crypto.createHash("md5").update(completeKhqr).digest("hex");

    return {
      khqrString: completeKhqr,
      md5Hash,
      billNumber: cleanBillNumber,
      amountUsd: numericAmount.toFixed(2),
    };
  }

  /**
   * Validates if a QR string is compliant with NBC / EMVCo CRC
   */
  static verifyKhqr(qrString) {
    try {
      return BakongKHQR.verify(qrString);
    } catch (e) {
      return { isValid: false };
    }
  }

  /**
   * Decodes a Bakong KHQR string into readable JSON fields
   */
  static decodeKhqr(qrString) {
    try {
      return BakongKHQR.decode(qrString);
    } catch (e) {
      return null;
    }
  }

  /**
   * Generates NBC Bakong App-to-App Deeplink shortLink
   */
  static async generateDeepLink(qrString, callbackUrl) {
    try {
      const sourceInfo = callbackUrl
        ? new SourceInfo(
            "https://api-bakong.nbc.gov.kh/khqr.png",
            config.BAKONG.merchantName || "LOTTO 4U",
            callbackUrl,
          )
        : undefined;

      const res = await BakongKHQR.generateDeepLink(
        "https://api-bakong.nbc.gov.kh/v1/generate_deeplink_by_qr",
        qrString,
        sourceInfo,
      );

      if (res?.status?.code === 0 && res?.data?.shortLink) {
        return res.data.shortLink;
      }
      return null;
    } catch (err) {
      console.warn("[KhqrService] Deeplink generation error:", err.message);
      return null;
    }
  }

  /**
   * Validates webhook signature
   */
  static verifyWebhookSignature(payload, signature) {
    if (!signature) return false;
    const computedSignature = crypto
      .createHmac("sha256", config.BAKONG.webhookSecret)
      .update(JSON.stringify(payload))
      .digest("hex");
    return computedSignature === signature;
  }

  /**
   * Fetches active Bakong Open API token directly from system_settings database table
   */
  static async getBakongApiToken() {
    try {
      const res = await db.query(
        "SELECT value FROM system_settings WHERE key = 'bakong_api_token' LIMIT 1;",
      );
      if (
        res.rows.length > 0 &&
        res.rows[0].value &&
        res.rows[0].value.trim()
      ) {
        return res.rows[0].value.trim();
      }
    } catch (e) {
      console.warn(
        "[KhqrService] Error reading bakong_api_token from DB:",
        e.message,
      );
    }
    return "";
  }

  /**
   * Resets the daily Bakong request counter if date changed
   */
  static resetDailyLimitIfNeeded() {
    const today = new Date().toDateString();
    if (KhqrService.dailyRequestDate !== today) {
      KhqrService.dailyRequestDate = today;
      KhqrService.dailyRequestCount = 0;
      KhqrService.dailyLimitExceededUntil = 0;
    }
  }

  /**
   * Queries Bakong Open API by MD5 hash of the generated KHQR
   * Endpoint: POST https://api-bakong.nbc.gov.kh/v1/check_transaction_by_md5
   * Header: Authorization: Bearer <BAKONG_API_TOKEN>
   * Body: { "md5": "<md5_hash>" }
   */
  static async checkBakongPayment(md5Hash, options = {}) {
    if (!md5Hash) {
      return { configured: false, paid: false, error: "MD5 hash is required" };
    }

    const { isBackground = false, bypassCache = false } = options;
    const cleanHash = String(md5Hash).trim();
    const now = Date.now();

    KhqrService.resetDailyLimitIfNeeded();

    // 1. In-Memory Cache: Prevent spamming Bakong repeatedly for the same hash (minimum 15s cache)
    const cached = KhqrService.checkCache.get(cleanHash);
    if (!bypassCache && cached && now - cached.timestamp < 15000) {
      return cached.result;
    }

    // 2. Circuit Breaker: If Bakong's daily limit (100) was exceeded, halt external requests
    if (now < KhqrService.dailyLimitExceededUntil) {
      const waitMinutes = Math.max(1, Math.ceil((KhqrService.dailyLimitExceededUntil - now) / 60000));
      const rateLimitResult = {
        configured: true,
        paid: false,
        rateLimited: true,
        responseCode: 1,
        errorCode: 17,
        responseMessage: `Bakong daily query limit (100) exceeded. Paused for ~${waitMinutes}m. Please use Admin Approval or try again later.`,
      };
      return rateLimitResult;
    }

    // 3. Quota budgeting: Conserve quota for real active users paying right now
    if (isBackground && KhqrService.dailyRequestCount >= 70) {
      return {
        configured: true,
        paid: false,
        rateLimited: true,
        responseMessage: "Background polling paused to conserve Bakong daily quota for active users.",
      };
    }

    // Safety threshold before 100
    if (KhqrService.dailyRequestCount >= 98) {
      KhqrService.dailyLimitExceededUntil = now + 60 * 60 * 1000; // 1-hour pause
      return {
        configured: true,
        paid: false,
        rateLimited: true,
        responseCode: 1,
        errorCode: 17,
        responseMessage: "Daily request limit safety threshold reached (98/100). External checks paused.",
      };
    }

    const token = await KhqrService.getBakongApiToken();
    const apiUrl =
      config.BAKONG.apiUrl ||
      process.env.BAKONG_API_URL ||
      "https://api-bakong.nbc.gov.kh/v1/check_transaction_by_md5";

    if (!token) {
      return {
        configured: false,
        paid: false,
        error: "BAKONG_API_TOKEN is not configured",
      };
    }

    try {
      KhqrService.dailyRequestCount++;
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ md5: cleanHash }),
      });

      const data = await response.json();
      console.log(
        `[KhqrService] checkBakongPayment response (today: ${KhqrService.dailyRequestCount}/100):`,
        data,
      );

      // Check for daily request limit error from Bakong
      if (
        data?.errorCode === 17 ||
        String(data?.responseMessage || "").toLowerCase().includes("limit of 100 exceeded") ||
        String(data?.responseMessage || "").toLowerCase().includes("daily request limit")
      ) {
        // Activate circuit breaker for 2 hours to avoid spamming rejected requests
        KhqrService.dailyLimitExceededUntil = Date.now() + 2 * 60 * 60 * 1000;
        console.warn(
          `[KhqrService] ⚠️ Bakong daily limit of 100 exceeded. Circuit breaker active until ${new Date(
            KhqrService.dailyLimitExceededUntil,
          ).toLocaleTimeString()}`,
        );

        const limitResult = {
          configured: true,
          paid: false,
          rateLimited: true,
          responseCode: data.responseCode,
          errorCode: data.errorCode,
          responseMessage: data.responseMessage,
        };
        KhqrService.checkCache.set(cleanHash, { timestamp: Date.now(), result: limitResult });
        return limitResult;
      }

      // Bakong Open API returns responseCode: 0 when payment is confirmed
      if (data && (data.responseCode === 0 || data.responseCode === "0")) {
        const successResult = {
          configured: true,
          paid: true,
          data: data.data,
        };
        KhqrService.checkCache.set(cleanHash, { timestamp: Date.now(), result: successResult });
        return successResult;
      }

      const notPaidResult = {
        configured: true,
        paid: false,
        responseCode: data?.responseCode,
        responseMessage: data?.responseMessage || "Transaction not yet paid",
      };
      KhqrService.checkCache.set(cleanHash, { timestamp: Date.now(), result: notPaidResult });
      return notPaidResult;
    } catch (err) {
      console.error("[KhqrService] checkBakongPayment error:", err.message);
      return {
        configured: true,
        paid: false,
        error: err.message,
      };
    }
  }

  /**
   * Decodes JWT payload to extract expiration date, time remaining, and token status
   */
  static getTokenDetails(tokenString) {
    if (!tokenString || typeof tokenString !== "string") return null;
    try {
      const parts = tokenString.trim().split(".");
      if (parts.length !== 3) return null;
      const payload = JSON.parse(
        Buffer.from(parts[1], "base64").toString("utf8"),
      );
      const expiresAt = payload.exp ? new Date(payload.exp * 1000) : null;
      const issuedAt = payload.iat ? new Date(payload.iat * 1000) : null;
      const now = Date.now();
      const msRemaining = expiresAt ? expiresAt.getTime() - now : 0;
      const daysRemaining = expiresAt
        ? Math.round(msRemaining / (1000 * 60 * 60 * 24))
        : 0;
      const isExpired = expiresAt ? now >= expiresAt.getTime() : false;

      // Token age in days since issuance
      const tokenAgeDays = issuedAt
        ? Math.max(
            0,
            Math.floor((now - issuedAt.getTime()) / (1000 * 60 * 60 * 24)),
          )
        : 0;

      // Auto-renew every 2 months (60 days from issuance, leaving a 30-day buffer on 90-day token)
      const renewIntervalDays = 60; // 2 months
      const renewAt = issuedAt
        ? new Date(issuedAt.getTime() + renewIntervalDays * 24 * 60 * 60 * 1000)
        : null;
      const msUntilRenew = renewAt ? renewAt.getTime() - now : 0;
      const daysUntilRenew = renewAt
        ? Math.max(0, Math.round(msUntilRenew / (1000 * 60 * 60 * 24)))
        : 0;
      const isDueForRenew =
        isExpired || (renewAt ? now >= renewAt.getTime() : daysRemaining <= 30);

      return {
        issuedAt,
        expiresAt,
        renewAt,
        tokenAgeDays,
        daysUntilRenew,
        isDueForRenew,
        renewIntervalMonths: 2,
        daysRemaining,
        isExpired,
        bakongId: payload.data?.id || null,
        formattedExpiry: expiresAt
          ? expiresAt.toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })
          : null,
        formattedRenewAt: renewAt
          ? renewAt.toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })
          : null,
      };
    } catch (e) {
      return null;
    }
  }

  /**
   * Renews the Bakong API token via NBC Bakong Open API
   */
  static async renewBakongToken(email) {
    if (!email) {
      throw new Error("Registered Bakong developer email is required");
    }

    const apiUrl =
      process.env.BAKONG_RENEW_URL ||
      "https://api-bakong.nbc.gov.kh/v1/renew_token";

    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: String(email).trim() }),
      });

      const data = await response.json();

      if (data && (data.responseCode === 0 || data.responseCode === "0")) {
        const newToken =
          data.data?.token ||
          data.data?.accessToken ||
          (typeof data.data === "string" ? data.data : null);
        if (newToken) {
          // Save new token to system_settings automatically
          await db.query(
            `
            INSERT INTO system_settings (key, value, updated_at)
            VALUES ('bakong_api_token', $1, NOW())
            ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW();
          `,
            [newToken],
          );
          return {
            success: true,
            renewed: true,
            token: newToken,
            message: "Bakong token renewed and saved successfully!",
          };
        }
        return {
          success: true,
          renewed: false,
          message:
            data.responseMessage ||
            "Renewal request accepted by NBC. Check your email for confirmation.",
        };
      }

      return {
        success: false,
        error: data?.responseMessage || "Failed to renew token with Bakong",
        errorCode: data?.errorCode,
      };
    } catch (err) {
      console.error("[KhqrService] renewBakongToken error:", err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Automatically checks if the Bakong API token is near expiration (within 7 days)
   * and requests a renewed token from NBC Bakong using the registered developer email.
   */
  static async checkAndAutoRenewToken() {
    try {
      const settingsRes = await db.query(
        "SELECT key, value FROM system_settings WHERE key IN ('bakong_api_token', 'bakong_developer_email');",
      );
      const settingsMap = {};
      settingsRes.rows.forEach((r) => {
        settingsMap[r.key] = r.value?.trim();
      });

      const token = settingsMap["bakong_api_token"];
      const email = settingsMap["bakong_developer_email"];

      if (!token) {
        return { status: "skipped", reason: "No token configured" };
      }

      const details = KhqrService.getTokenDetails(token);
      if (!details) {
        return { status: "skipped", reason: "Invalid token format" };
      }

      console.log(
        `[KhqrService] Bakong token status: ${details.daysRemaining} days remaining (Expires: ${details.formattedExpiry}) | Age: ${details.tokenAgeDays}d | 2-month Auto-Renew: ${details.formattedRenewAt} (${details.daysUntilRenew}d left)`,
      );

      if (!email) {
        return {
          status: "notice",
          reason:
            "Token active, but registered developer email not set for auto-renewal",
          daysUntilRenew: details.daysUntilRenew,
          formattedRenewAt: details.formattedRenewAt,
        };
      }

      // Automatically renew every 2 months (60 days old, <= 30 days remaining on 90-day validity, or expired)
      if (
        details.isDueForRenew ||
        details.daysRemaining <= 30 ||
        details.isExpired
      ) {
        console.log(
          `[KhqrService] Bakong token is due for 2-month auto-renewal (Age: ${details.tokenAgeDays}d, Exp in: ${details.daysRemaining}d). Triggering auto-renewal for ${email}...`,
        );
        const renewRes = await KhqrService.renewBakongToken(email);

        if (renewRes.success) {
          console.log("[KhqrService] Bakong token successfully auto-renewed!");
          try {
            await db.query(
              `INSERT INTO audit_logs (admin_id, action, target_type, details)
               VALUES (NULL, 'bakong_token_auto_renewed', 'system_setting', $1)`,
              [
                JSON.stringify({
                  email,
                  renewRes,
                  prevExpiresAt: details.expiresAt,
                }),
              ],
            );
          } catch (e) {}
          return { status: "renewed", result: renewRes };
        } else {
          console.warn(
            "[KhqrService] Auto-renewal attempt warning:",
            renewRes.error,
          );
          return { status: "failed", error: renewRes.error };
        }
      }

      return {
        status: "active",
        daysRemaining: details.daysRemaining,
        expiresAt: details.expiresAt,
        renewAt: details.renewAt,
        daysUntilRenew: details.daysUntilRenew,
        formattedRenewAt: details.formattedRenewAt,
      };
    } catch (err) {
      console.warn("[KhqrService] checkAndAutoRenewToken error:", err.message);
      return { status: "error", error: err.message };
    }
  }

  /**
   * Starts a background worker to continuously poll pending KHQR transactions
   * against NBC Bakong Open API, and runs scheduled auto-renewal checks every 12 hours.
   */
  static startPollingWorker(intervalSeconds = 5) {
    if (this.workerTimer) return;

    // Check token renewal 5 seconds after startup, then every 12 hours
    setTimeout(() => {
      KhqrService.checkAndAutoRenewToken().catch((e) =>
        console.warn("[KhqrService] Token auto-renew check error:", e.message),
      );
    }, 5000);

    this.autoRenewTimer = setInterval(
      () => {
        KhqrService.checkAndAutoRenewToken().catch((e) =>
          console.warn(
            "[KhqrService] Token auto-renew check error:",
            e.message,
          ),
        );
      },
      12 * 60 * 60 * 1000,
    ); // 12 hours

    this.workerTimer = setInterval(async () => {
      if (this.isWorkerRunning) return;
      this.isWorkerRunning = true;

      try {
        KhqrService.resetDailyLimitIfNeeded();

        // If rate limit circuit breaker is active or quota is reserved for active users, skip worker cycle
        if (Date.now() < KhqrService.dailyLimitExceededUntil || KhqrService.dailyRequestCount >= 70) {
          this.isWorkerRunning = false;
          return;
        }

        // Find recent pending transactions within the last 15 minutes (limit 2 to prevent consuming quota)
        const pendingRes = await db.query(`
          SELECT id, md5_hash, user_id, amount_usd, coin_amount
          FROM khqr_transactions
          WHERE status = 'pending' 
            AND created_at >= NOW() - INTERVAL '15 minutes'
          ORDER BY created_at DESC
          LIMIT 2;
        `);

        if (pendingRes.rows.length === 0) {
          this.isWorkerRunning = false;
          return;
        }

        const token = await KhqrService.getBakongApiToken();
        if (!token) {
          this.isWorkerRunning = false;
          return;
        }

        const KhqrController = require("../controllers/khqrController");

        for (const tx of pendingRes.rows) {
          try {
            const check = await KhqrService.checkBakongPayment(tx.md5_hash, { isBackground: true });
            if (check.paid) {
              const settlement = await KhqrController.settleTransaction(tx.id);
              if (!settlement.alreadyCompleted) {
                console.log(
                  `[KhqrWorker] Auto-settled KHQR tx ${tx.id} for user ${tx.user_id} (+${tx.coin_amount} coins)`,
                );
              }
            }
          } catch (txErr) {
            console.warn(
              `[KhqrWorker] Error verifying tx ${tx.id}:`,
              txErr.message,
            );
          }
        }

        // Auto-expire pending transactions older than 30 minutes
        await db.query(`
          UPDATE khqr_transactions
          SET status = 'expired', updated_at = NOW()
          WHERE status = 'pending' AND created_at < NOW() - INTERVAL '30 minutes';
        `);
      } catch (err) {
        console.warn("[KhqrWorker] Polling cycle error:", err.message);
      } finally {
        this.isWorkerRunning = false;
      }
    }, Math.max(30, intervalSeconds) * 1000);
  }

  static stopPollingWorker() {
    if (this.workerTimer) {
      clearInterval(this.workerTimer);
      this.workerTimer = null;
    }
    if (this.autoRenewTimer) {
      clearInterval(this.autoRenewTimer);
      this.autoRenewTimer = null;
    }
  }
}

KhqrService.workerTimer = null;
KhqrService.autoRenewTimer = null;
KhqrService.isWorkerRunning = false;
KhqrService.checkCache = new Map();
KhqrService.dailyLimitExceededUntil = 0;
KhqrService.dailyRequestCount = 0;
KhqrService.dailyRequestDate = new Date().toDateString();

module.exports = KhqrService;
