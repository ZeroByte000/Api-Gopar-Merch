const https = require("https");
const crypto = require("crypto");
const { URL } = require("url");

const ME_URL = "https://api.gobiz.co.id/v1/users/me";
const MERCHANTS_SEARCH_URL = "https://api.gobiz.co.id/v1/merchants/search";

function parseTlv(input) {
  const items = [];
  let i = 0;
  while (i + 4 <= input.length) {
    const tag = input.slice(i, i + 2);
    const lenStr = input.slice(i + 2, i + 4);
    const len = parseInt(lenStr, 10);
    const value = input.slice(i + 4, i + 4 + len);
    if (Number.isNaN(len) || value.length !== len) {
      throw new Error("Format QRIS tidak valid");
    }
    items.push({ tag, value });
    i += 4 + len;
  }
  if (i !== input.length) {
    throw new Error("Format QRIS tidak valid");
  }
  return items;
}

function buildTlv(items) {
  return items
    .map((item) => {
      const len = String(item.value.length).padStart(2, "0");
      return `${item.tag}${len}${item.value}`;
    })
    .join("");
}

function crc16Ccitt(payload) {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i += 1) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j += 1) {
      if (crc & 0x8000) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc <<= 1;
      }
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function normalizeAmount(input) {
  const raw = String(input).trim();
  if (!raw) return null;
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return null;
  return String(parseInt(digits, 10));
}

function updateQrisAmount(qris, amount) {
  const items = parseTlv(qris).filter((item) => item.tag !== "63");

  const poiIndex = items.findIndex((item) => item.tag === "01");
  if (poiIndex >= 0) {
    items[poiIndex].value = "12";
  } else {
    items.unshift({ tag: "01", value: "12" });
  }

  const amountIndex = items.findIndex((item) => item.tag === "54");
  if (amountIndex >= 0) {
    items[amountIndex].value = amount;
  } else {
    const countryIndex = items.findIndex((item) => item.tag === "58");
    const insertAt = countryIndex >= 0 ? countryIndex : items.length;
    items.splice(insertAt, 0, { tag: "54", value: amount });
  }

  const payload = buildTlv(items);
  const withCrcTag = `${payload}6304`;
  const crc = crc16Ccitt(withCrcTag);
  return `${withCrcTag}${crc}`;
}

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
      accept: "application/json, text/plain, */*",
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

async function fetchStaticQris(accessToken) {
  const meRes = await getJson(ME_URL, accessToken);
  const merchantId = meRes.json?.user?.merchant_id;
  if (!merchantId) {
    throw new Error("merchant_id tidak ditemukan dari API /v1/users/me");
  }

  const searchPayload = {
    from: 0,
    size: 200,
    _source: [
      "id",
      "tags",
      "payment_settings.GOPAY",
      "pops",
      "aspi",
      "merchant_type",
      "merchant_name",
      "outlet_name",
    ],
  };
  const searchRes = await postJson(MERCHANTS_SEARCH_URL, accessToken, searchPayload);
  const hits = searchRes.json?.hits || [];
  const merchant =
    hits.find((item) => item.id === merchantId) ||
    hits.find((item) => item.tags?.merchant_id?.includes(merchantId));
  const pops = merchant?.pops || [];
  const gopayPop = pops.find((pop) => pop.gopay?.aspi_qr_string);
  const qris = gopayPop?.gopay?.aspi_qr_string;

  if (!qris) {
    throw new Error("aspi_qr_string tidak ditemukan dari API merchants/search");
  }

  return qris;
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
    const amount = normalizeAmount(body.jumlah);
    if (!amount) {
      res.statusCode = 400;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ error: "jumlah wajib diisi" }));
      return;
    }

    const qris = await fetchStaticQris(accessToken);

    const dynamicQris = updateQrisAmount(qris, amount);
    const proto = req.headers["x-forwarded-proto"] || "http";
    const host =
      req.headers["x-forwarded-host"] || req.headers.host || "localhost:3000";
    const qrisImageUrl = `${proto}://${host}/qris_string=${encodeURIComponent(
      dynamicQris
    )}`;
    res.statusCode = 200;
    res.setHeader("content-type", "application/json");
    res.end(
      JSON.stringify({
        jumlah: amount,
        qris: dynamicQris,
        qris_image: qrisImageUrl,
      })
    );
  } catch (err) {
    res.statusCode = 500;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ error: err.message || String(err) }));
  }
};
