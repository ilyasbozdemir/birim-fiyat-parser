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
    titleBarStyle: 'default',
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

  mainWindow.loadURL(startUrl);

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }
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
    
    if (isDev) {
      pythonExecutable = process.platform === 'win32'
        ? path.join(__dirname, '../venv/Scripts/python.exe')
        : path.join(__dirname, '../venv/bin/python');
    } else {
      pythonExecutable = path.join(process.resourcesPath, 'python/extract_prices');
    }

    const scriptPath = path.join(__dirname, '../python/extract_prices.py');
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
      if (code !== 0) {
        console.error('Python Error:', errorOutput);
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
            error: 'JSON parse hatası: ' + e.message + '\nÇıktı: ' + output, 
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
  if (!fs.existsSync(pdfPath)) {
    return { error: 'Belirtilen dosya mevcut değil: ' + pdfPath, success: false };
  }
  return await runPythonExtractor(pdfPath);
});

// URL'den PDF İndir ve Parse Et
ipcMain.handle('extract-from-url', async (event, pdfUrl) => {
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
