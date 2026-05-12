import * as xlsx from 'xlsx';

export interface ParsedTransactionRow {
  tanggal: string; // YYYY-MM-DD
  kategoriNama: string;
  jumlah: number;
  deskripsi: string;
}

export function parseExcelBuffer(buffer: Buffer): ParsedTransactionRow[] {
  // Membaca buffer Excel
  const workbook = xlsx.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0]; // Ambil sheet pertama
  const worksheet = workbook.Sheets[sheetName];

  // Mengubah sheet menjadi array objek JSON
  // Asumsi header pada baris pertama: "Tanggal", "Kategori", "Jumlah", "Deskripsi"
  const rawData = xlsx.utils.sheet_to_json(worksheet, { raw: false }) as any[];

  const parsedData: ParsedTransactionRow[] = [];

  for (let i = 0; i < rawData.length; i++) {
    const row = rawData[i];
    
    // Konversi key menjadi case-insensitive / seragam untuk validasi
    // Kita anggap kolom dari user bisa saja sedikit berbeda casingnya
    const getVal = (keyNames: string[]) => {
      const foundKey = Object.keys(row).find(k => keyNames.includes(k.toLowerCase().trim()));
      return foundKey ? row[foundKey] : null;
    };

    const tanggalStr = getVal(['tanggal', 'date', 'waktu']);
    const kategoriStr = getVal(['kategori', 'category']);
    const jumlahStr = getVal(['jumlah', 'nominal', 'amount', 'harga']);
    const deskripsiStr = getVal(['deskripsi', 'keterangan', 'description', 'nama barang', 'item']);

    // Validasi kelengkapan data per baris
    if (!tanggalStr || !kategoriStr || !jumlahStr) {
      throw new Error(`Baris ke-${i + 2}: Data tidak lengkap (Tanggal, Kategori, dan Jumlah wajib diisi).`);
    }

    // Sesuai permintaan: Deskripsi wajib karena penting untuk analisis AI
    if (!deskripsiStr || deskripsiStr.trim() === '') {
      throw new Error(`Baris ke-${i + 2}: Kolom Deskripsi/Keterangan wajib diisi! AI butuh ini untuk menganalisis pengeluaran Anda (contoh: "Mie Ayam", "Gojek", dll).`);
    }

    // Normalisasi Jumlah
    const jumlah = parseInt(jumlahStr.replace(/[^0-9]/g, ''), 10);
    if (isNaN(jumlah) || jumlah <= 0) {
      throw new Error(`Baris ke-${i + 2}: Kolom Jumlah tidak valid.`);
    }

    // Normalisasi Tanggal (Sangat bergantung pada format, jika string: pastikan bisa di-parse)
    // Excel date (jika raw: false) biasanya terbaca 'M/D/YY' atau 'YYYY-MM-DD' tergantung lokalisasi
    let tanggal = new Date(tanggalStr);
    if (isNaN(tanggal.getTime())) {
      // Coba parse format DD/MM/YYYY secara manual jika gagal
      const parts = tanggalStr.split(/[/\-]/);
      if (parts.length === 3) {
        // Asumsi format Indonesia DD/MM/YYYY
        if (parts[0].length === 2 && parts[2].length === 4) {
          tanggal = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
        } else {
          throw new Error(`Baris ke-${i + 2}: Format tanggal tidak valid (${tanggalStr}). Gunakan format YYYY-MM-DD.`);
        }
      } else {
        throw new Error(`Baris ke-${i + 2}: Format tanggal tidak valid (${tanggalStr}). Gunakan format YYYY-MM-DD.`);
      }
    }

    const isoDate = tanggal.toISOString().split('T')[0]; // Format YYYY-MM-DD

    parsedData.push({
      tanggal: isoDate,
      kategoriNama: kategoriStr.toString().trim(),
      jumlah: jumlah,
      deskripsi: deskripsiStr.toString().trim()
    });
  }

  return parsedData;
}
