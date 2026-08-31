#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const axios = require('axios');

// ANSI Renk Kodları
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  red: '\x1b[31m',
  gray: '\x1b[90m',
};

function printBanner() {
  console.log(`
${colors.cyan}${colors.bright}=======================================================
 📄 BİRİM FİYAT & RAYİÇ PARSER CLI (Pro)
 ${colors.gray}PDF ve Web Bağlantılarından Hızlı Poz/Rayiç Çıkarıcı
${colors.cyan}=======================================================${colors.reset}
`);
}

function printHelp() {
  printBanner();
  console.log(`
${colors.yellow}${colors.bright}KULLANIM:${colors.reset}
  pnpm cli <pdf-yolu-veya-url> [seçenekler]
  node bin/cli.js <pdf-yolu-veya-url> [seçenekler]

${colors.yellow}${colors.bright}ÖRNEKLER:${colors.reset}
  ${colors.cyan}pnpm cli "C:\\Belgeler\\fiyat_listesi.pdf"${colors.reset}
  ${colors.cyan}pnpm cli "https://site.com/fiyatlar.pdf" -o sonuc.csv${colors.reset}
  ${colors.cyan}pnpm cli "fiyatlar.pdf" --search "demir" --limit 20${colors.reset}
  ${colors.cyan}pnpm cli "fiyatlar.pdf" -o veri.json -f json${colors.reset}

${colors.yellow}${colors.bright}SEÇENEKLER:${colors.reset}
  ${colors.green}-o, --output <dosya>${colors.reset}     Ayrıştırılan verileri CSV, JSON veya TSV olarak kaydeder.
  ${colors.green}-f, --format <format>${colors.reset}    Çıktı formatı: csv | json | tsv | table (Varsayılan: otomatik)
  ${colors.green}-s, --search <kelime>${colors.reset}    Poz no, açıklama veya kategoriye göre anlık filtreleme.
  ${colors.green}-l, --limit <sayı>${colors.reset}       Konsolda listelenecek maksimum satır sayısı (Varsayılan: 30).
  ${colors.green}-q, --quiet${colors.reset}              Başlık ve logları gizler, sadece saf JSON çıktısı verir.
  ${colors.green}-h, --help${colors.reset}               Bu yardım menüsünü görüntüler.
`);
}

async function runPythonExtractor(pdfPath, quiet = false) {
  return new Promise((resolve, reject) => {
    let pythonExecutable;
    const winVenv = path.join(__dirname, '../venv/Scripts/python.exe');
    const nixVenv = path.join(__dirname, '../venv/bin/python');

    if (fs.existsSync(winVenv)) {
      pythonExecutable = winVenv;
    } else if (fs.existsSync(nixVenv)) {
      pythonExecutable = nixVenv;
    } else {
      pythonExecutable = process.platform === 'win32' ? 'python' : 'python3';
    }

    const scriptPath = path.join(__dirname, '../python/extract_prices.py');
    const python = spawn(pythonExecutable, [scriptPath, pdfPath]);

    let stdoutData = '';
    let stderrData = '';

    python.stdout.on('data', (data) => {
      stdoutData += data.toString('utf-8');
    });

    python.stderr.on('data', (data) => {
      stderrData += data.toString('utf-8');
      if (!quiet) {
        process.stderr.write(colors.gray + data.toString() + colors.reset);
      }
    });

    python.on('close', (code) => {
      if (code !== 0 && !stdoutData) {
        return reject(new Error(stderrData || `Python ayrıştırma hatası (Kod: ${code})`));
      }
      try {
        const parsed = JSON.parse(stdoutData);
        resolve(parsed);
      } catch (err) {
        reject(new Error(`JSON ayrıştırma hatası: ${err.message}\nÇıktı:\n${stdoutData}`));
      }
    });
  });
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
    printHelp();
    process.exit(0);
  }

  let inputSource = null;
  let outputFile = null;
  let format = null;
  let searchTerm = null;
  let limit = 30;
  let quiet = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-o' || arg === '--output') {
      outputFile = args[++i];
    } else if (arg === '-f' || arg === '--format') {
      format = args[++i]?.toLowerCase();
    } else if (arg === '-s' || arg === '--search') {
      searchTerm = args[++i]?.toLowerCase();
    } else if (arg === '-l' || arg === '--limit') {
      limit = parseInt(args[++i], 10) || 30;
    } else if (arg === '-q' || arg === '--quiet') {
      quiet = true;
    } else if (!arg.startsWith('-') && !inputSource) {
      inputSource = arg;
    }
  }

  if (!inputSource) {
    console.error(`${colors.red}Hata: Lütfen ayrıştırılacak bir PDF dosyası veya URL belirtin.${colors.reset}`);
    printHelp();
    process.exit(1);
  }

  if (!quiet) {
    printBanner();
    console.log(`${colors.blue}🔍 Hedef: ${colors.bright}${inputSource}${colors.reset}`);
  }

  let targetPdfPath = inputSource;
  let isTempFile = false;

  // URL Kontrolü
  if (inputSource.startsWith('http://') || inputSource.startsWith('https://')) {
    if (!quiet) console.log(`${colors.yellow}⏳ PDF web üzerinden indiriliyor...${colors.reset}`);
    const tempDir = os.tmpdir();
    targetPdfPath = path.join(tempDir, `cli_download_${Date.now()}.pdf`);
    isTempFile = true;

    try {
      const response = await axios({
        method: 'get',
        url: inputSource,
        responseType: 'arraybuffer',
        timeout: 60000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      fs.writeFileSync(targetPdfPath, Buffer.from(response.data));
      if (!quiet) console.log(`${colors.green}✅ İndirme tamamlandı.${colors.reset}`);
    } catch (err) {
      console.error(`${colors.red}❌ URL'den indirme başarısız: ${err.message}${colors.reset}`);
      process.exit(1);
    }
  } else {
    // Yerel Dosya Kontrolü
    const resolvedPath = path.resolve(inputSource);
    if (!fs.existsSync(resolvedPath)) {
      console.error(`${colors.red}❌ Dosya bulunamadı: ${resolvedPath}${colors.reset}`);
      process.exit(1);
    }
    targetPdfPath = resolvedPath;
  }

  const startTime = Date.now();
  if (!quiet) console.log(`${colors.cyan}⚙️  Ayrıştırma motoru başlatılıyor...${colors.reset}`);

  try {
    const result = await runPythonExtractor(targetPdfPath, quiet);

    if (isTempFile) {
      try { fs.unlinkSync(targetPdfPath); } catch (e) {}
    }

    if (!result.success || result.error) {
      console.error(`${colors.red}❌ Ayrıştırma hatası: ${result.error || 'Bilinmeyen hata'}${colors.reset}`);
      process.exit(1);
    }

    let items = result.data || [];
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    if (!quiet) {
      console.log(`\n${colors.green}${colors.bright}✅ Başarılı! ${items.length} adet poz kalemi ayrıştırıldı (${duration}s)${colors.reset}`);
    }

    // Arama / Filtreleme
    if (searchTerm) {
      items = items.filter(item => 
        (item.pozNo && item.pozNo.toLowerCase().includes(searchTerm)) ||
        (item.tanim && item.tanim.toLowerCase().includes(searchTerm)) ||
        (item.birim && item.birim.toLowerCase().includes(searchTerm)) ||
        (item.satinAlmaYeri && item.satinAlmaYeri.toLowerCase().includes(searchTerm)) ||
        (item.kategori && item.kategori.toLowerCase().includes(searchTerm))
      );
      if (!quiet) {
        console.log(`${colors.magenta}🔎 "${searchTerm}" araması için ${items.length} sonuç bulundu.${colors.reset}`);
      }
    }

    // Dosyaya Kaydetme (Output File)
    if (outputFile) {
      const ext = path.extname(outputFile).toLowerCase();
      const resolvedOutput = path.resolve(outputFile);

      if (format === 'json' || ext === '.json') {
        fs.writeFileSync(resolvedOutput, JSON.stringify(items, null, 2), 'utf-8');
        console.log(`${colors.green}💾 JSON dosyası kaydedildi: ${colors.bright}${resolvedOutput}${colors.reset}`);
      } else if (format === 'tsv' || ext === '.tsv') {
        const hasSa = items.some(i => i.satinAlmaYeri);
        const headers = ['Poz No', 'Tanım', 'Birim'];
        if (hasSa) headers.push('Satın Alma Yeri');
        headers.push('Fiyat (TL)', 'Kategori');

        const tsvLines = [
          headers.join('\t'),
          ...items.map(i => {
            const r = [i.pozNo || '', i.tanim || '', i.birim || ''];
            if (hasSa) r.push(i.satinAlmaYeri || '');
            r.push(i.fiyat || '', i.kategori || '');
            return r.join('\t');
          })
        ];
        fs.writeFileSync(resolvedOutput, tsvLines.join('\n'), 'utf-8');
        console.log(`${colors.green}💾 TSV dosyası kaydedildi: ${colors.bright}${resolvedOutput}${colors.reset}`);
      } else {
        // Varsayılan CSV (UTF-8 BOM ile)
        const hasSa = items.some(i => i.satinAlmaYeri);
        const headers = ['Poz No', 'Tanım', 'Birim'];
        if (hasSa) headers.push('Satın Alma Yeri');
        headers.push('Fiyat (TL)', 'Kategori / Bölüm');

        const csvLines = [
          headers,
          ...items.map(i => {
            const r = [i.pozNo || '', i.tanim || '', i.birim || ''];
            if (hasSa) r.push(i.satinAlmaYeri || '');
            r.push(i.fiyat || '', i.kategori || '');
            return r;
          })
        ]
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');

        fs.writeFileSync(resolvedOutput, '\uFEFF' + csvLines, 'utf-8');
        console.log(`${colors.green}💾 CSV dosyası kaydedildi: ${colors.bright}${resolvedOutput}${colors.reset}`);
      }
    }

    // Konsol Tablosu Gösterimi
    if (!quiet && (!outputFile || format === 'table')) {
      console.log(`\n${colors.cyan}--- Önizleme (İlk ${Math.min(limit, items.length)} / ${items.length} Kalem) ---${colors.reset}`);
      
      const hasSa = items.some(i => i.satinAlmaYeri);
      const displayItems = items.slice(0, limit).map((i, idx) => {
        const row = {
          '#': idx + 1,
          'Poz No': i.pozNo || '-',
          'Tanım': (i.tanim && i.tanim.length > 40) ? i.tanim.substring(0, 37) + '...' : (i.tanim || '-'),
          'Birim': i.birim || 'Adet',
        };
        if (hasSa) {
          row['Satın Alma'] = i.satinAlmaYeri || '-';
        }
        row['Fiyat (TL)'] = i.fiyat ? `${i.fiyat} ₺` : '-';
        return row;
      });

      console.table(displayItems);

      if (items.length > limit) {
        console.log(`${colors.gray}... ve ${items.length - limit} satır daha. Tümünü görmek için -o sonuc.csv kullanın veya --limit parametresi verin.${colors.reset}`);
      }
    } else if (quiet) {
      console.log(JSON.stringify(items));
    }

  } catch (err) {
    if (isTempFile) {
      try { fs.unlinkSync(targetPdfPath); } catch (e) {}
    }
    console.error(`${colors.red}❌ Beklenmeyen hata: ${err.message}${colors.reset}`);
    process.exit(1);
  }
}

main();
