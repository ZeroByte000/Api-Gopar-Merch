const https = require("https");
const fs = require("fs");
const crypto = require("crypto");

const CONFIG_PATH = "node/config.json";
let config = {};
try {
  config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
} catch (err) {
  if (err.code !== "ENOENT") {
    console.error(`Failed to read ${CONFIG_PATH}: ${err.message}`);
    process.exit(1);
  }
}

const EMAIL = config.email || process.env.GOFOOD_EMAIL;
const PASSWORD = config.password || process.env.GOFOOD_PASSWORD;

if (!EMAIL || !PASSWORD) {
  console.error(
    `Missing credentials. Set email/password in ${CONFIG_PATH} or GOFOOD_EMAIL/GOFOOD_PASSWORD env.`
  );
  process.exit(1);
}

if (!config.email || !config.password) {
  const updated = {
    email: EMAIL,
    password: PASSWORD,
  };
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(updated, null, 2));
  config = updated;
}

const COMMON_HEADERS = {
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
  "x-uniqueid": crypto.randomUUID(),
  "x-verification-method": "password",
  origin: "https://portal.gofoodmerchant.co.id",
  referer: "https://portal.gofoodmerchant.co.id/",
  "user-agent":
    "Mozilla/5.0 (X11; Linux aarch64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 CrKey/1.54.250320",
};

function postJson(path, body) {
  const payload = JSON.stringify(body);
  const options = {
    hostname: "api.gobiz.co.id",
    path,
    method: "POST",
    headers: {
      ...COMMON_HEADERS,
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
          reject(new Error(`Invalid JSON response: ${data}`));
        }
      });
    });

    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

async function main() {
  const loginReq = await postJson("/goid/login/request", {
    email: config.email,
    login_type: "password",
    client_id: "go-biz-web-new",
  });

  if (loginReq.status !== 201) {
    throw new Error(
      `login/request failed (${loginReq.status}): ${JSON.stringify(
        loginReq.json
      )}`
    );
  }

  const tokenRes = await postJson("/goid/token", {
    client_id: "go-biz-web-new",
    grant_type: "password",
    data: {
      email: config.email,
      password: config.password,
    },
  });

  if (tokenRes.status !== 201) {
    throw new Error(
      `token failed (${tokenRes.status}): ${JSON.stringify(tokenRes.json)}`
    );
  }

  const { access_token, refresh_token } = tokenRes.json || {};
  if (!access_token || !refresh_token) {
    throw new Error(`token response missing tokens: ${JSON.stringify(tokenRes.json)}`);
  }

  const output = {
    access_token,
    refresh_token,
  };

  fs.writeFileSync("node/response.json", JSON.stringify(output, null, 2));
  console.log("Saved tokens to node/response.json");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
