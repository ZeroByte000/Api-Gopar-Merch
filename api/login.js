const https = require("https");
const crypto = require("crypto");

const DEBUG =
  process.env.DEBUG === "true" ? true : process.env.VERCEL ? false : true;

function logDebug(message) {
  if (!DEBUG) return;
  console.log(message);
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

function buildCommonHeaders(uniqueId) {
  return {
    accept: "application/json, text/plain, */*",
    "accept-language": "id",
    "content-type": "application/json",
    "authentication-type": "go-id",
    authorization: "Bearer",
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
    "x-uniqueid": uniqueId,
    "x-verification-method": "password",
    origin: "https://portal.gofoodmerchant.co.id",
    referer: "https://portal.gofoodmerchant.co.id/",
    "user-agent":
      "Mozilla/5.0 (X11; Linux aarch64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 CrKey/1.54.250320",
  };
}

function postJson(path, body, commonHeaders, extraHeaders = {}) {
  const payload = JSON.stringify(body);
  const options = {
    hostname: "api.gobiz.co.id",
    path,
    method: "POST",
    headers: {
      ...commonHeaders,
      "content-length": Buffer.byteLength(payload),
      ...extraHeaders,
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

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ error: "Method tidak diizinkan" }));
    return;
  }

  try {
    logDebug("API /login hit");
    const body = await readBody(req);
    const email = body.email;
    const password = body.password;

    if (!email || !password) {
      res.statusCode = 400;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ error: "email dan password wajib diisi" }));
      return;
    }

    const uniqueId = crypto.randomUUID();
    const commonHeaders = buildCommonHeaders(uniqueId);

    logDebug("Mengirim login/request...");
    const loginReq = await postJson(
      "/goid/login/request",
      {
        email,
        login_type: "password",
        client_id: "go-biz-web-new",
      },
      commonHeaders
    );
    logDebug(`login/request status: ${loginReq.status}`);

    if (loginReq.status !== 201 || !loginReq.json?.success) {
      res.statusCode = 401;
      res.setHeader("content-type", "application/json");
      res.end(
        JSON.stringify({
          error: "login/request gagal",
          detail: loginReq.json,
        })
      );
      return;
    }

    logDebug("Mengirim token...");
    const tokenRes = await postJson(
      "/goid/token",
      {
        client_id: "go-biz-web-new",
        grant_type: "password",
        data: {
          email,
          password,
        },
      },
      commonHeaders
    );
    logDebug(`token status: ${tokenRes.status}`);

    if (tokenRes.status !== 201 || !tokenRes.json?.access_token) {
      res.statusCode = 401;
      res.setHeader("content-type", "application/json");
      res.end(
        JSON.stringify({
          error: "token gagal",
          detail: tokenRes.json,
        })
      );
      return;
    }

    res.statusCode = 200;
    res.setHeader("content-type", "application/json");
    res.end(
      JSON.stringify({
        access_token: tokenRes.json.access_token,
        refresh_token: tokenRes.json.refresh_token,
        dbl_enabled: tokenRes.json.dbl_enabled,
      })
    );
  } catch (err) {
    res.statusCode = 500;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ error: err.message || String(err) }));
  }
};
