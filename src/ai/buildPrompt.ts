export function buildMonthlyWrappedPrompt(userName: string, month: string, year: string, transactionSummary: string) {
  return `
    Anda adalah pembuat "Monthly Wrapped" keuangan, mirip seperti Spotify Wrapped namun untuk pengeluaran uang. 
    Tugas Anda adalah merangkum pengeluaran pengguna bernama ${userName} untuk bulan ${month} tahun ${year} berdasarkan data transaksi berikut:
    ${transactionSummary}

    Buatlah ringkasan yang menyenangkan, engaging, dan sedikit sarkastik atau humoris jika pengguna boros, atau memuji jika pengguna hemat.

    Berdasarkan data di atas, tolong berikan analisis dalam format JSON persis seperti berikut (tanpa markdown backticks \`\`\`json):
    {
      "total_pengeluaran": (angka total pengeluaran bulan ini),
      "kategori_terfavorit": "nama kategori dengan pengeluaran terbesar",
      "hari_paling_boros": "hari dalam seminggu di mana pengeluaran paling tinggi (misal: Jumat)",
      "barang_termahal": "nama barang/deskripsi transaksi dengan harga paling tinggi",
      "tanggal_terboros": "tanggal (YYYY-MM-DD) dengan total pengeluaran harian tertinggi",
      "detail_tanggal_terboros": "Penjelasan singkat barang apa saja yang dibeli pada tanggal terboros tersebut dan totalnya",
      "tips_bulan_depan": "2-3 tips konkret untuk menghemat di bulan berikutnya berdasarkan pola bulan ini",
      "vibe_bulan_ini": "Satu kata atau frasa singkat menggambarkan gaya belanja bulan ini (misal: 'Si Paling Healing', 'Raja Hemat')",
      "pesan_lucu": "Pesan 2-3 kalimat yang engaging dan agak sassy atau memuji terkait kebiasaan belanja di bulan ini."
    }
    Pastikan respons hanya berupa JSON valid agar bisa di-parse oleh sistem.
  `;
}

export function buildChallengesPrompt(userName: string, month: string, year: string, transactionSummary: string) {
  return `
    Halo Gemini! Kamu adalah coach finansial yang cerdas dan asik.
    Berdasarkan histori pengeluaran ${userName} di bulan ${month} ${year} berikut:
    ${transactionSummary}

    Tugasmu adalah membuat 3 Tantangan (Challenges) Menabung untuk bulan berikutnya agar ${userName} bisa lebih hemat.
    
    Analisis data tersebut untuk mencari kebiasaan buruk (misal: jajan kopi tiap hari, belanja impulsive di malam hari, terlalu sering gofood).
    
    Berikan respons dalam format JSON persis seperti berikut:
    {
      "challenges": [
        {
          "title": "Judul tantangan yang menarik dan menantang (misal: No Coffee Shop for 7 Days)",
          "savings_pct": 10,
          "difficulty": "Easy"
        }
      ]
    }

    PENTING:
    - Berikan tepat 3 tantangan dengan tingkat kesulitan yang bervariasi (Easy, Medium, Hardcore).
    - Judul harus spesifik dan berorientasi pada tindakan.
    - Hanya kembalikan JSON valid tanpa markdown backticks.
  `;
}
