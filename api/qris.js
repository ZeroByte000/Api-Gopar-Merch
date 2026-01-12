const { URL } = require("url");
const QRCode = require("qrcode");

async function buildHtml(qris) {
  const dataUrl = await QRCode.toDataURL(qris, { width: 300, margin: 1 });
  return `<!doctype html>
<html lang="id">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>QRIS</title>
    <style>
      body { font-family: Arial, sans-serif; background: #f7f7f7; margin: 0; }
      .wrap { max-width: 720px; margin: 40px auto; padding: 24px; background: #fff; border-radius: 12px; }
      .qr { display: flex; justify-content: center; margin: 20px 0; }
      .code { word-break: break-all; font-size: 12px; color: #444; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <h2>QRIS Dinamis</h2>
      <div class="qr">
        <img src="${dataUrl}" alt="QRIS" />
      </div>
      <div class="code">${qris}</div>
    </div>
  </body>
</html>`;
}

module.exports = async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const qris = url.searchParams.get("data") || url.searchParams.get("qris");
  const asImage = url.searchParams.get("image") === "1";

  if (!qris) {
    res.statusCode = 400;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ error: "qris wajib diisi" }));
    return;
  }

  try {
    if (asImage) {
      const buffer = await QRCode.toBuffer(qris, { width: 300, margin: 1 });
      res.statusCode = 200;
      res.setHeader("content-type", "image/png");
      res.end(buffer);
      return;
    }

    const html = await buildHtml(qris);
    res.statusCode = 200;
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.end(html);
  } catch (err) {
    res.statusCode = 500;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ error: err.message || String(err) }));
  }
};
