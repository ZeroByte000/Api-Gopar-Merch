const https = require("https");
const crypto = require("crypto");
const { URL } = require("url");

const TRANSACTIONS_URL = "https://api.gobiz.co.id/journals/search";
const ME_URL = "https://api.gobiz.co.id/v1/users/me";

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => {
      if (!data) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(data));
      } catch (err) {
        reject(new Error("Body bukan JSON yang valid"));
      }
    });
    req.on("error", reject);
  });
}

function getJson(urlString, token) {
  const url = new URL(urlString);
  const options = {
    hostname: url.hostname,
    path: `${url.pathname}${url.search}`,
    method: "GET",
    headers: {
      accept: "application/json, text/plain, */*",
      "accept-language": "en-US,en;q=0.9,id;q=0.8",
      "authentication-type": "go-id",
      authorization: `Bearer ${token}`,
      "gojek-country-code": "ID",
      "gojek-timezone": "Asia/Jakarta",
      "x-appid": "go-biz-web-dashboard",
      "x-appversion": "platform-v3.96.0-c4506a9b",
      "x-deviceos": "Web",
      "x-phonemake": "Linux aarch64",
      "x-phonemodel": "Chrome 143.0.0.0 on Linux aarch64",
      "x-platform": "Web",
      "x-user-type": "merchant",
      "x-user-locale": "en-US",
      "x-uniqueid": crypto.randomUUID(),
      origin: "https://portal.gofoodmerchant.co.id",
      referer: "https://portal.gofoodmerchant.co.id/",
      "user-agent":
        "Mozilla/5.0 (X11; Linux aarch64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 CrKey/1.54.250320",
    },
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, json });
        } catch (err) {
          reject(new Error(`Response bukan JSON: ${data}`));
        }
      });
    });
    req.on("error", reject);
    req.end();
  });
}

function postJson(urlString, token, body) {
  const url = new URL(urlString);
  const payload = JSON.stringify(body);
  const options = {
    hostname: url.hostname,
    path: `${url.pathname}${url.search}`,
    method: "POST",
    headers: {
      accept: "application/json, text/plain, */*, application/vnd.journal.v1+json",
      "accept-language": "en-US,en;q=0.9,id;q=0.8",
      "content-type": "application/json",
      "authentication-type": "go-id",
      authorization: `Bearer ${token}`,
      "gojek-country-code": "ID",
      "gojek-timezone": "Asia/Jakarta",
      "x-appid": "go-biz-web-dashboard",
      "x-appversion": "platform-v3.96.0-c4506a9b",
      "x-deviceos": "Web",
      "x-phonemake": "Linux aarch64",
      "x-phonemodel": "Chrome 143.0.0.0 on Linux aarch64",
      "x-platform": "Web",
      "x-user-type": "merchant",
      "x-user-locale": "en-US",
      "x-uniqueid": crypto.randomUUID(),
      origin: "https://portal.gofoodmerchant.co.id",
      referer: "https://portal.gofoodmerchant.co.id/",
      "user-agent":
        "Mozilla/5.0 (X11; Linux aarch64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 CrKey/1.54.250320",
      "content-length": Buffer.byteLength(payload),
    },
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, json });
        } catch (err) {
          reject(new Error(`Response bukan JSON: ${data}`));
        }
      });
    });
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

function getJakartaDayRangeIso() {
  const now = new Date();
  const jktOffsetMs = 7 * 60 * 60 * 1000;
  const jktNow = new Date(now.getTime() + jktOffsetMs);
  const year = jktNow.getUTCFullYear();
  const month = jktNow.getUTCMonth();
  const day = jktNow.getUTCDate();

  const startJktUtc = new Date(Date.UTC(year, month, day, 0, 0, 0, 0) - jktOffsetMs);
  const endJktUtc = new Date(
    Date.UTC(year, month, day, 23, 59, 59, 999) - jktOffsetMs
  );

  return {
    from: startJktUtc.toISOString(),
    to: endJktUtc.toISOString(),
  };
}

function parseTransactions(apiResponse) {
  if (!apiResponse || !Array.isArray(apiResponse.hits)) {
    return [];
  }

  return apiResponse.hits
    .map((hit) => {
      const metadata = hit.metadata || {};
      const transaction = metadata.transaction || {};
      const gopayData = metadata.gopay || {};

      const amountCents = hit.amount || 0;
      const amountRupiah = amountCents / 100;

      return {
        tanggalWaktu: hit.time || hit.created_at || "",
        idPesanan: transaction.order_id || hit.reference_id || "",
        idReferensiGopay: gopayData.gopay_transaction_id || hit.id || "",
        tipePesanan: "GoFood",
        tipePembayaran: transaction.payment_type || "",
        penjualanKotor: `Rp ${amountRupiah.toLocaleString("id-ID")}`,
        jumlah: amountRupiah,
        jumlahCents: amountCents,
        status: hit.status || transaction.status || "",
        issuer: metadata.issuer || "",
        merchantId: hit.merchant_id || "",
      };
    })
    .filter(Boolean);
}

function parseJumlahInput(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value);
  }
  const raw = String(value).trim();
  if (!raw) return null;
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return null;
  return parseInt(digits, 10);
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ error: "Method tidak diizinkan" }));
    return;
  }

  try {
    const auth = req.headers.authorization || "";
    if (!auth.startsWith("Bearer ")) {
      res.statusCode = 401;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ error: "Header Authorization Bearer wajib" }));
      return;
    }

    const accessToken = auth.replace("Bearer ", "").trim();
    const body = await readBody(req);
    const jumlahFilter = parseJumlahInput(body.jumlah);

    const meRes = await getJson(ME_URL, accessToken);
    const merchantId = meRes.json?.user?.merchant_id;
    if (!merchantId) {
      res.statusCode = 401;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ error: "merchant_id tidak ditemukan" }));
      return;
    }

    const payload = {
      from: 0,
      size: 20,
      sort: { time: { order: "desc" } },
      included_categories: { incoming: ["transaction_share", "action"] },
      query: [
        {
          clauses: [
            {
              op: "not",
              clauses: [
                {
                  clauses: [
                    {
                      field: "metadata.source",
                      op: "in",
                      value: ["GOSAVE_ONLINE", "GoSave", "GODEALS_ONLINE"],
                    },
                    {
                      field: "metadata.gopay.source",
                      op: "in",
                      value: ["GOSAVE_ONLINE", "GoSave", "GODEALS_ONLINE"],
                    },
                  ],
                  op: "or",
                },
              ],
            },
            {
              field: "metadata.transaction.status",
              op: "in",
              value: ["settlement", "capture", "refund", "partial_refund"],
            },
            {
              op: "or",
              clauses: [
                {
                  op: "or",
                  clauses: [
                    {
                      field: "metadata.transaction.payment_type",
                      op: "in",
                      value: [
                        "qris",
                        "gopay",
                        "offline_credit_card",
                        "offline_debit_card",
                        "credit_card",
                      ],
                    },
                  ],
                },
              ],
            },
            {
              field: "metadata.transaction.merchant_id",
              op: "equal",
              value: merchantId,
            },
          ],
          op: "and",
        },
      ],
    };

    const resTrx = await postJson(TRANSACTIONS_URL, accessToken, payload);
    let transactions = parseTransactions(resTrx.json);
    if (jumlahFilter !== null) {
      transactions = transactions.filter((t) => t.jumlah === jumlahFilter);
      if (transactions.length === 0) {
        res.statusCode = 404;
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ error: "transaksi tidak ditemukan" }));
        return;
      }
    }

    res.statusCode = 200;
    res.setHeader("content-type", "application/json");
    res.end(
      JSON.stringify(
        {
          scrapedAt: new Date().toISOString(),
          dateRange: "today",
          totalCount: transactions.length,
          apiTotal: resTrx.json?.total || 0,
          transactions,
        },
        null,
        2
      )
    );
  } catch (err) {
    res.statusCode = 500;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ error: err.message || String(err) }));
  }
};
