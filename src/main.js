const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const axios = require('axios');
const isDev = require('electron-is-dev');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1024,
    minHeight: 700,
    title: 'Birim Fiyat Parser Pro',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false
    }
  });

  const startUrl = isDev
    ? 'http://127.0.0.1:3000'
    : `file://${path.join(__dirname, '../dist/index.html')}`;

  console.log(`[Main] Uygulama yükleniyor: ${startUrl} (isDev: ${isDev})`);
  mainWindow.loadURL(startUrl);

  // F12 ve Ctrl+Shift+I ile DevTools açıp kapatabilme
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i')) {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  // DevTools'u otomatik aç
  mainWindow.webContents.openDevTools();
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// PDF Dosya Seçimi Dialog
ipcMain.handle('select-pdf', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Birim Fiyat PDF Dosyası Seçin',
    properties: ['openFile'],
    filters: [{ name: 'PDF Dosyaları (*.pdf)', extensions: ['pdf'] }]
  });
  
  if (result.canceled || !result.filePaths || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

// Helper: Python betiğini çalıştır
function runPythonExtractor(pdfPath) {
  return new Promise((resolve) => {
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
    console.log(`[Python Executing] ${pythonExecutable} ${scriptPath} "${pdfPath}"`);

    const python = spawn(pythonExecutable, [scriptPath, pdfPath]);

    let output = '';
    let errorOutput = '';

    python.stdout.on('data', (data) => {
      output += data.toString();
    });

    python.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    python.on('close', (code) => {
      console.log(`[Python Exited] Code: ${code}`);
      if (errorOutput) {
        console.warn(`[Python Stderr]:`, errorOutput);
      }
      console.log(`[Python Stdout]:`, output);

      if (code !== 0 && !output) {
        resolve({ 
          error: errorOutput || `Python işlemi ${code} kodu ile başarısız oldu.`, 
          success: false 
        });
      } else {
        try {
          const result = JSON.parse(output);
          resolve(result);
        } catch (e) {
          console.error('JSON Parse Error:', e);
          resolve({ 
            error: `JSON parse hatası: ${e.message}\n\nPython Çıktısı:\n${output || errorOutput}`, 
            success: false 
          });
        }
      }
    });

    // 45 saniye zaman aşımı
    setTimeout(() => {
      try {
        python.kill();
      } catch (err) {}
      resolve({ error: 'İşlem zaman aşımına uğradı (45s).', success: false });
    }, 45000);
  });
}

// Dosya Yolundan Fiyat Çıkar
ipcMain.handle('extract-prices', async (event, pdfPath) => {
  console.log(`[IPC: extract-prices] Dosya yolu: ${pdfPath}`);
  if (!fs.existsSync(pdfPath)) {
    return { error: 'Belirtilen dosya mevcut değil: ' + pdfPath, success: false };
  }
  return await runPythonExtractor(pdfPath);
});

// URL'den PDF İndir ve Parse Et
ipcMain.handle('extract-from-url', async (event, pdfUrl) => {
  console.log(`[IPC: extract-from-url] URL: ${pdfUrl}`);
  try {
    const tempDir = os.tmpdir();
    const tempFileName = `birim_fiyat_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.pdf`;
    const tempFilePath = path.join(tempDir, tempFileName);

    const response = await axios({
      method: 'get',
      url: pdfUrl,
      responseType: 'arraybuffer',
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    fs.writeFileSync(tempFilePath, Buffer.from(response.data));
    console.log(`[IPC: extract-from-url] Geçici PDF kaydedildi: ${tempFilePath}`);

    const result = await runPythonExtractor(tempFilePath);
    
    // Geçici dosyayı temizle
    try {
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    } catch (e) {
      console.warn('Geçici dosya silinemedi:', e.message);
    }

    return result;
  } catch (err) {
    return {
      error: `URL'den PDF indirilemedi veya işlenemedi: ${err.message}`,
      success: false
    };
  }
});
