import { pool } from '../db/pool';
import { aiModel } from './geminiClient';
import { buildMonthlyWrappedPrompt, buildChallengesPrompt } from './buildPrompt';
import { getUserById } from '../db/queries/userQueries';
import * as challengeQueries from '../db/queries/challengeQueries';

/**
 * Membantu membersihkan respons JSON dari Markdown backticks (```json ... ```)
 */
function parseGeminiJSON(text: string) {
  try {
    const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleaned);
  } catch (err) {
    throw new Error('Gagal mem-parse JSON dari Gemini: ' + text);
  }
}

export async function generateMonthlyWrapped(userId: string, month: string, year: string) {
  const user = await getUserById(userId);
  if (!user) throw new Error('User tidak ditemukan');

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const targetMonth = parseInt(month);
  const targetYear = parseInt(year);

  if (targetYear > currentYear || (targetYear === currentYear && targetMonth >= currentMonth)) {
    throw new Error('Wrapped bulan ini belum tersedia. Tunggu sampai bulan berakhir!');
  }

  // 1. Total Pengeluaran Bulan Ini
  const totalRes = await pool.query(
    `SELECT SUM(jumlah) as total FROM pengeluaran 
     WHERE user_id = $1 AND EXTRACT(MONTH FROM tanggal) = $2 AND EXTRACT(YEAR FROM tanggal) = $3`,
    [userId, parseInt(month), parseInt(year)]
  );
  const totalPengeluaran = totalRes.rows[0].total || 0;

  if (totalPengeluaran === 0) {
    return null;
  }

  // 2. Kategori Terfavorit (Berdasarkan Jumlah Pengeluaran Terbesar)
  const categoryRes = await pool.query(
    `SELECT k.nama, SUM(t.jumlah) as total_per_kat 
     FROM pengeluaran t 
     JOIN kategori k ON t.kategori_id = k.id 
     WHERE t.user_id = $1 AND EXTRACT(MONTH FROM t.tanggal) = $2 AND EXTRACT(YEAR FROM t.tanggal) = $3 
     GROUP BY k.nama 
     ORDER BY total_per_kat DESC LIMIT 1`,
    [userId, parseInt(month), parseInt(year)]
  );
  const topCategory = categoryRes.rows[0]?.nama || 'Umum';

  // 3. Barang Termahal
  const expensiveRes = await pool.query(
    `SELECT deskripsi, jumlah FROM pengeluaran 
     WHERE user_id = $1 AND EXTRACT(MONTH FROM tanggal) = $2 AND EXTRACT(YEAR FROM tanggal) = $3 
     ORDER BY jumlah DESC LIMIT 1`,
    [userId, parseInt(month), parseInt(year)]
  );
  const expensiveItem = expensiveRes.rows[0]?.deskripsi || '-';

  // 4. Hari Paling Boros dalam Satu Minggu (Agregat Seluruh Bulan)
  const dayOfWeekRes = await pool.query(
    `SELECT 
        EXTRACT(DOW FROM tanggal) as dow, 
        SUM(jumlah) as total_per_hari_nama 
     FROM pengeluaran 
     WHERE user_id = $1 AND EXTRACT(MONTH FROM tanggal) = $2 AND EXTRACT(YEAR FROM tanggal) = $3 
     GROUP BY dow 
     ORDER BY total_per_hari_nama DESC`,
    [userId, parseInt(month), parseInt(year)]
  );

  const dayNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const topDayData = dayOfWeekRes.rows[0];
  const topDayName = topDayData ? dayNames[parseInt(topDayData.dow)] : "-";

  // 5. Tanggal Spesifik Terboros (Puncak Pengeluaran Harian)
  const worstDayRes = await pool.query(
    `SELECT tanggal, SUM(jumlah) as total_harian 
     FROM pengeluaran 
     WHERE user_id = $1 AND EXTRACT(MONTH FROM tanggal) = $2 AND EXTRACT(YEAR FROM tanggal) = $3 
     GROUP BY tanggal 
     ORDER BY total_harian DESC LIMIT 1`,
    [userId, parseInt(month), parseInt(year)]
  );
  const worstDay = worstDayRes.rows[0];

  // 6. Rincian Barang di Tanggal Terboros
  let worstDayDetails = "";
  if (worstDay) {
    const detailsRes = await pool.query(
      `SELECT deskripsi, jumlah FROM pengeluaran 
       WHERE user_id = $1 AND tanggal = $2`,
      [userId, worstDay.tanggal]
    );
    worstDayDetails = detailsRes.rows.map(r => `${r.deskripsi} (Rp${r.jumlah})`).join(', ');
  }

  // 7. Rangkuman Semua pengeluaran (Untuk Konteks Vibe & Pesan Lucu)
  const allTransRes = await pool.query(
    `SELECT deskripsi, jumlah, tanggal FROM pengeluaran 
     WHERE user_id = $1 AND EXTRACT(MONTH FROM tanggal) = $2 AND EXTRACT(YEAR FROM tanggal) = $3 
     ORDER BY tanggal ASC`,
    [userId, parseInt(month), parseInt(year)]
  );
  const transactions = allTransRes.rows;

  const summaryString = `
    Total Pengeluaran: Rp${totalPengeluaran}
    Kategori Terbesar: ${topCategory}
    Barang Termahal: ${expensiveItem}
    Hari Paling Boros (Mingguan): ${topDayName} (Hari di mana akumulasi pengeluaran paling tinggi di bulan ini)
    Tanggal Spesifik Terboros: ${worstDay ? new Date(worstDay.tanggal).toLocaleDateString('id-ID') : '-'} (Total: Rp${worstDay?.total_harian || 0})
    Detail Belanja di Tanggal Terboros: ${worstDayDetails}
    
    Data Akumulasi per Hari (untuk konteks):
    ${dayOfWeekRes.rows.map(r => `- ${dayNames[parseInt(r.dow)]}: Rp${r.total_per_hari_nama}`).join('\n')}

    Daftar Belanja (untuk inspirasi pesan lucu/vibe):
    ${transactions.map(t => `- ${t.deskripsi} (Rp${t.jumlah})`).join('\n')}
  `;

  // Get month name
  const monthName = new Date(`${year}-${month}-01`).toLocaleString('id-ID', { month: 'long' });

  const prompt = buildMonthlyWrappedPrompt(user.nama, monthName, year, summaryString);
  const result = await aiModel.generateContent(prompt);
  const responseText = result.response.text();

  const parsed = parseGeminiJSON(responseText);

  // Normalisasi data: Pastikan tips_bulan_depan adalah string (antisipasi jika AI mengembalikan array)
  if (Array.isArray(parsed.tips_bulan_depan)) {
    parsed.tips_bulan_depan = parsed.tips_bulan_depan.join('\n');
  } else if (!parsed.tips_bulan_depan) {
    parsed.tips_bulan_depan = "";
  }

  // Simpan ke DB
  const insertResult = await pool.query(
    `INSERT INTO user_monthly_wrapped (user_id, bulan, tahun, data, created_at)
     VALUES ($1, $2, $3, $4, NOW())
     RETURNING *`,
    [userId, month, year, JSON.stringify(parsed)]
  );

  return insertResult.rows[0].data;
}

export async function analyzeReceipt(base64Image: string) {
  const prompt = `
    Kamu adalah asisten pengolah struk belanja. 
    Analisis gambar struk yang diberikan dan ekstrak informasi berikut dalam format JSON:
    {
      "tanggal": "YYYY-MM-DD",
      "kategori": "Kategori barang (misal: Makan, Jajan, Transportasi, Belanja Bulanan, Hiburan, Kesehatan)",
      "jumlah": harga barang yang dibayar,
      "deskripsi": "Deskripsi singkat barang yang dibeli (1-2 kata)"
    }

    PENTING:
    - Jika tanggal tidak ditemukan, gunakan tanggal hari ini.
    - Pastikan "jumlah" adalah angka murni (number).
    - Berikan "kategori" yang paling relevan.
    - Hanya kembalikan JSON, jangan ada teks lain.
  `;

  // Deteksi mimeType dari prefix data URI
  let mimeType = "image/jpeg";
  const match = base64Image.match(/^data:([^;]+);base64,/);
  if (match) {
    mimeType = match[1];
  }

  // Hilangkan prefix data:image/...;base64, jika ada
  const base64Data = base64Image.split(',')[1] || base64Image;

  const result = await aiModel.generateContent([
    prompt,
    {
      inlineData: {
        data: base64Data,
        mimeType: mimeType
      }
    }
  ]);

  const responseText = result.response.text();
  return parseGeminiJSON(responseText);
}

export async function getOrGenerateChallenges(userId: string, targetMonth?: number, targetYear?: number, force: boolean = false) {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const month = targetMonth || currentMonth;
  const year = targetYear || currentYear;

  const isCurrentMonth = month === currentMonth && year === currentYear;

  // 1. Cek apakah sudah ada challenges di DB
  let challenges = await challengeQueries.getChallenges(userId, month, year);
  if (challenges.length > 0) return challenges;

  // 2. Jika tidak ada dan bukan bulan ini, jangan generate OTOMATIS
  // Tapi jika force=true (dari button), maka tetap generate
  if (!isCurrentMonth && !force) {
    return [];
  }

  // 3. Jika belum ada (bulan ini), ambil data bulan lalu untuk dianalisis AI
  const targetDate = new Date(`${year}-${month.toString().padStart(2, '0')}-01`);
  const prevDate = new Date(targetDate);
  prevDate.setMonth(prevDate.getMonth() - 1);
  const prevMonth = prevDate.getMonth() + 1;
  const prevYear = prevDate.getFullYear();

  const user = await getUserById(userId);
  if (!user) throw new Error("User tidak ditemukan");

  const transRes = await pool.query(
    `SELECT p.deskripsi, p.jumlah, k.nama as kategori 
     FROM pengeluaran p 
     JOIN kategori k ON p.kategori_id = k.id 
     WHERE p.user_id = $1 AND EXTRACT(MONTH FROM p.tanggal) = $2 AND EXTRACT(YEAR FROM p.tanggal) = $3`,
    [userId, prevMonth, prevYear]
  );

  const monthName = prevDate.toLocaleString("id-ID", { month: "long" });

  if (transRes.rows.length === 0) {
    throw new Error(`Maaf, kami tidak menemukan data transaksi pada bulan ${monthName} ${prevYear}. AI membutuhkan data bulan sebelumnya untuk meracik tantangan yang personal.`);
  }

  const summary = transRes.rows.map(r => `- ${r.deskripsi} (${r.kategori}): Rp${r.jumlah}`).join("\n");

  const prompt = buildChallengesPrompt(user.nama, monthName, prevYear.toString(), summary);
  const result = await aiModel.generateContent(prompt);
  const parsed = parseGeminiJSON(result.response.text());

  // 4. Simpan ke DB
  const savedChallenges = [];
  for (const c of parsed.challenges) {
    const saved = await challengeQueries.insertChallenge(userId, month, year, c);
    savedChallenges.push(saved);
  }

  return savedChallenges;
}

