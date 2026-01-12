const http = require("http");
const { URL } = require("url");

const loginHandler = require("./api/login");
const cekTransaksiHandler = require("./api/cek-transaksi");
const createPaymentHandler = require("./api/create-payment");
const qrisHandler = require("./api/qris");

const PORT = process.env.PORT || 3000;
const DEBUG =
  process.env.DEBUG === "true" ? true : process.env.VERCEL ? false : true;

function logDebug(message) {
  if (!DEBUG) return;
  console.log(message);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  logDebug(`${req.method} ${url.pathname}`);

  if (url.pathname === "/api/login") {
    loginHandler(req, res);
    return;
  }

  if (url.pathname === "/api/cek-transaksi") {
    cekTransaksiHandler(req, res);
    return;
  }

  if (url.pathname === "/api/create-payment") {
    createPaymentHandler(req, res);
    return;
  }

  if (url.pathname.startsWith("/qris_string=")) {
    req.url = `/api/qris?data=${url.pathname.slice(
      "/qris_string=".length
    )}&image=1`;
    qrisHandler(req, res);
    return;
  }

  if (url.pathname === "/api/qris") {
    qrisHandler(req, res);
    return;
  }

  res.statusCode = 404;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify({ error: "Not found" }));
});

server.listen(PORT, () => {
  logDebug(`Local API running on http://localhost:${PORT}`);
});
