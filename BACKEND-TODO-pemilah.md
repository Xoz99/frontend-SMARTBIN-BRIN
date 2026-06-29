# Permintaan ke Tim Backend — Integrasi Pemilah Otomatis & Statistik Jenis Sampah

Konteks: frontend butuh data **jenis sampah hasil pemilah** (organik/anorganik/b3)
biar bisa nampilin "jenis apa yang paling sering" di halaman Analitik. Datanya
**sudah tersimpan** di tabel `classifications`, jadi mostly tinggal nambah jalur
masuk dari raspi + 1 endpoint baca. Ada **2 item**:

---

## 1. MQTT: terima hasil pemilahan yang SUDAH diklasifikasi (untuk raspi-pemilah)

**Kenapa:** raspi-pemilah itu **device (= bin)**, jadi auth-nya lewat **broker MQTT**
(kredensial broker + `nodeId` di topik) — sama seperti sensor/status/image. **Bukan**
lewat `/deposits` (itu untuk WARGA yang login). Raspi juga **sudah klasifikasi sendiri**
(model TFLite lokal), jadi nggak perlu inferensi ulang di server.

Sekarang handler `image` (`smartbin/+/image`) menerima **gambar mentah** lalu manggil
classify service. Tambahkan **satu topik baru** untuk hasil yang sudah jadi:

**Topik:** `smartbin/{nodeId}/classification`
**Payload:**
```json
{ "label": "organik", "confidence": 0.93 }
```
- `label`: `organik` | `anorganik` | `b3` (lowercase). Selain itu → `unknown`.
- `confidence`: 0–1 (opsional).

**Yang dilakukan handler** (mirip `imageData.js`, tapi tanpa panggil classify service):
1. `bin = prisma.bin.findUnique({ where: { nodeId } })` — kalau tak ada, drop.
2. `prisma.classification.create({ data: { binId: bin.id, label, confidence, rawResult: payload } })`
3. (Jika `WEIGHT_MODE === 'sensor_pairing'`) `setPendingLabel(bin.id, { label, confidence, userId: null })`
   biar deposit otomatis kebentuk saat berat load-cell tiba.
4. Publish command sort balik: `smartbin/{nodeId}/command` → `{ "action": label }`.
5. `broadcast('CLASSIFICATION_NEW', { id, nodeId, binId, label, confidence, createdAt })`.

**Perubahan di `topics.js`:** tambah `CLASSIFICATION: 'smartbin/+/classification'`
ke `TOPICS`, dan `getTopicType` otomatis sudah balikin `'classification'`
(bagian ketiga topik). Lalu tambah `case 'classification'` di `subscriber.js`.

> Praktis ini ±20 baris (1 handler baru + 2 baris registrasi topik). Tidak ada
> perubahan skema DB — `classifications` sudah ada.

---

## 2. REST: `GET /classifications/summary` (untuk halaman Analitik FE)

Agregasi jumlah & persentase per jenis. **Hitung di DB** (`GROUP BY label`),
jangan kirim baris mentah — `classifications` sudah ter-index di `createdAt`.

**Query (semua opsional):** `from`, `to` (ISO date), `binId`, `areaId`
**Auth:** sama seperti endpoint lain (`authenticate`); PETUGAS otomatis dibatasi area-nya.

**Response 200** (ikut amplop standar `{ success, message, data }`):
```json
{
  "success": true,
  "message": "Success",
  "data": {
    "total": 1240,
    "totalWeightKg": 1240.5,
    "byLabel": [
      { "label": "organik",   "count": 558, "weightKg": 540.2, "percentage": 45 },
      { "label": "anorganik", "count": 434, "weightKg": 410.0, "percentage": 35 },
      { "label": "b3",        "count": 149, "weightKg":  90.3, "percentage": 12 },
      { "label": "unknown",   "count":  99, "weightKg":   0,   "percentage":  8 }
    ],
    "mostCommon": "organik"
  }
}
```
- `byLabel` sebaiknya **selalu memuat keempat label** (count 0 kalau tak ada),
  biar FE gampang. Kalau tidak pun FE sudah menangani label yang hilang.
- `weightKg`/`totalWeightKg` boleh `null`/0 kalau berat tidak relevan
  (berat ada di tabel `deposits`; kalau mau, JOIN — kalau tidak, kirim 0).
- `percentage` dibulatkan ke integer (berdasarkan `count`).

> FE sudah memanggil endpoint ini. Selama belum ada (404), FE otomatis fallback
> menghitung dari `GET /deposits`. Jadi tidak ada yang rusak; begitu endpoint ini
> live, angka di Analitik langsung beralih ke sumber resmi tanpa perubahan FE.

---

## 3. REST: filter rentang waktu `from`/`to` di endpoint Analitik

Halaman Analitik punya pilihan periode (Hari ini / Minggu ini / Bulan ini / Custom).
FE **sudah mengirim** query `from` & `to` (ISO date) ke endpoint-endpoint ini saat
periode berganti — backend tinggal menyaring berdasarkan `createdAt`:

| Endpoint | Query baru | Filter |
|---|---|---|
| `GET /deposits` | `from`, `to` | `deposits.createdAt BETWEEN from AND to` |
| `GET /alerts` | `from`, `to` | `alerts.createdAt BETWEEN from AND to` |
| `GET /analytics/weekly-volume` | `from`, `to` | titik volume harian di rentang itu (bukan selalu 7 hari) |

- Semua **opsional**; tanpa `from`/`to` → perilaku lama (kompatibel mundur).
- `GET /classifications/summary` sudah menerima `from`/`to` (lihat bagian 2).
- Sementara BE belum menyaring, FE masih memfilter `deposits`/`alerts` di sisi klien,
  jadi angka tetap benar. Tapi grafik **"Volume per hari"** butuh BE menghormati
  rentang agar bisa menampilkan >7 hari (mis. "Bulan ini").

---

## Catatan kecil untuk tim raspi (`raspi-pemilah/main.py`)

- `LABEL_MAP` (baris ~57) masih `"B3": "B3"` → harus `"B3": "b3"` (enum lowercase).
- Tambah MQTT client (`paho-mqtt`), connect ke broker yang sama dengan bin lain
  (`MQTT_BROKER_URL`/`MQTT_USERNAME`/`MQTT_PASSWORD` dari `.env` backend).
- Setelah `kirim_ke_arduino(kategori)` (baris ~292), publish:
  `smartbin/{NODE_ID}/classification` → `{ "label": LABEL_MAP[kategori], "confidence": conf }`.
- `NODE_ID` di-set via env (raspi perlu tahu dia bin mana).
