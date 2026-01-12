const https = require("https");
const fs = require("fs");
const crypto = require("crypto");
const { URL } = require("url");

const RESPONSE_PATH = "node/response.json";
const TRANSACTIONS_URL = "https://api.gobiz.co.id/journals/search";
const ME_URL = "https://api.gobiz.co.id/v1/users/me";

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

let accessToken;
try {
  const tokenData = readJson(RESPONSE_PATH);
  accessToken = tokenData.access_token;
} catch (err) {
  console.error(`Gagal membaca ${RESPONSE_PATH}: ${err.message}`);
  process.exit(1);
}

if (!accessToken) {
  console.error(`access_token tidak ditemukan di ${RESPONSE_PATH}`);
  process.exit(1);
}

const transactionsUrl = TRANSACTIONS_URL;

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

async function main() {
  const meRes = await getJson(ME_URL, accessToken);
  const merchantId = meRes.json?.user?.merchant_id;
  if (!merchantId) {
    throw new Error("merchant_id tidak ditemukan dari API /v1/users/me");
  }

  const range = getJakartaDayRangeIso();
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
            field: "metadata.transaction.transaction_time",
            op: "gte",
            value: range.from,
          },
          {
            field: "metadata.transaction.transaction_time",
            op: "lte",
            value: range.to,
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

  const res = await postJson(transactionsUrl, accessToken, payload);
  const transactions = parseTransactions(res.json);
  const output = {
    scrapedAt: new Date().toISOString(),
    dateRange: "today",
    totalCount: transactions.length,
    apiTotal: res.json?.total || 0,
    transactions,
  };

  console.log(JSON.stringify(output, null, 2));
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
