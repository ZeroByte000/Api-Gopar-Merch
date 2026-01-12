### Cek mutasi qris gopay merchant

Repo: https://github.com/ZeroByte000/Api-Gopar-Merch

API ini siap di-hosting di Vercel menggunakan Serverless Functions.

Struktur endpoint:

- `POST /api/login` - login dengan email dan password, return access token
- `POST /api/cek-transaksi` - cek transaksi dengan header `Authorization: Bearer <token>`
- `POST /api/create-payment` - ubah QRIS statis menjadi dinamis (input jumlah)

#### 1) Login

Request:

```bash
curl -X POST https://api-gopar-merch.vercel.app/api/login \
  -H "content-type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "your_password"
  }'
```

Response (contoh):

```json
{
  "access_token": "eyJhbGciOi...",
  "refresh_token": "eyJhbGciOi...",
  "dbl_enabled": true
}
```

#### 2) Cek transaksi

Request:

```bash
curl -X POST https://api-gopar-merch.vercel.app/api/cek-transaksi \
  -H "content-type: application/json" \
  -H "authorization: Bearer eyJhbGciOi..."
```

Catatan:

- Endpoint ini selalu mengembalikan transaksi paling terbaru.

Contoh filter berdasarkan jumlah:

```bash
curl -X POST https://api-gopar-merch.vercel.app/api/cek-transaksi \
  -H "content-type: application/json" \
  -H "authorization: Bearer eyJhbGciOi..." \
  -d '{
    "jumlah": "25.500"
  }'
```

Response (contoh):

```json
{
  "scrapedAt": "2026-01-12T10:00:00.000Z",
  "dateRange": "today",
  "totalCount": 2,
  "apiTotal": 2,
  "transactions": [
    {
      "tanggalWaktu": "2026-01-12T10:40:15Z",
      "idPesanan": "QRIS-04202601121040153l4zrADm9LID",
      "idReferensiGopay": "04202601121040153l4zrADm9LID",
      "tipePesanan": "GoFood",
      "tipePembayaran": "qris",
      "penjualanKotor": "Rp 25.000",
      "jumlah": 25000,
      "jumlahCents": 2500000,
      "status": "success",
      "issuer": "DANA",
      "merchantId": "G692242439"
    }
  ]
}
```

#### 3) Create payment (QRIS dinamis)

Request:

```bash
curl -X POST https://api-gopar-merch.vercel.app/api/create-payment \
  -H "content-type: application/json" \
  -d '{
    "jumlah": "25.500"
  }'
```

Response (contoh):

```json
{
  "jumlah": "25500",
  "qris": "000201010212...",
  "qris_image": "https://api-gopar-merch.vercel.app/qris_string=000201010212..."
}
```
