# 📄 Birim Fiyat Parser Pro

Birim Fiyat Parser Pro; kamu ihale, bakanlık veya özel birim fiyat cetveli PDF belgelerindeki fiyat tablolarını saniyeler içinde tespit edip ayrıştıran, gelişmiş arama, filtreleme, sıralama ve çoklu formatta dışa aktarma (CSV, JSON, Excel TSV) sunan modern bir Electron & React masaüstü uygulamasıdır.

---

## ✨ Özellikler

- **📁 Çoklu Giriş Yöntemi:**
  - **Sürükle-Bırak (Drag & Drop):** PDF dosyasını pencereye sürükleyin ve anında ayrıştırın.
  - **Dosya Seçici:** Klasik dosya seçici ile PDF yükleme.
  - **🌐 Web / URL Desteği:** Herhangi bir web sitesindeki PDF bağlantısını girerek doğrudan indirme ve parse etme.
- **⚡ Akıllı Tablo Ayrıştırma:**
  - Python tabanlı Camelot ve Pandas motoru.
  - Hem çizgili (Lattice) hem de çizgisiz/akış (Stream) tabloları otomatik tespit etme.
  - Poz no, tanım, birim ve fiyat sütunlarını akıllıca eşleme ve temizleme.
- **🎨 Modern & Premium Kullanıcı Deneyimi:**
  - **Tailwind CSS v3:** Koyu mod (dark mode) ve cam efekti (glassmorphism).
  - **Radix UI Primitives:** Tabs, Dialog (detaylı poz önizleme), Tooltip ve Toast bildirimleri.
  - **Lucide Icons:** Zengin SVG ikonografi.
- **📊 Veri Yönetimi & Dışa Aktarma:**
  - Canlı Arama ve Poz No / Tanım filtreleme.
  - Artan / Azalan sütun sıralama (fiyatlar için sayısal sıralama).
  - Sayfalama (Pagination).
  - **CSV İndir** (Excel uyumlu UTF-8 BOM ile Türkçe karakter desteği).
  - **JSON İndir**.
  - **Panoya Kopyala (TSV):** Tek tıkla Excel veya Google E-Tablolar'a doğrudan yapıştırma formatı.

---

## 🛠️ Mimari & Teknolojiler

- **Masaüstü:** [Electron](https://www.electronjs.org/)
- **Ön Yüz:** [React 18](https://react.dev/), [Vite](https://vitejs.dev/)
- **Stil & Bileşenler:** [Tailwind CSS](https://tailwindcss.com/), [Radix UI](https://www.radix-ui.com/), [Lucide React](https://lucide.dev/)
- **Paket Yöneticisi:** [pnpm](https://pnpm.io/)
- **Veri Ayrıştırma Motoru:** Python (`camelot-py`, `pandas`, `openpyxl`)
- **CI / CD:** GitHub Actions (Derleme, test ve otomatik Release oluşturma)

---

## 🚀 Başlarken

### 1. Depoyu Klonlayın
```bash
git clone https://github.com/ilyasbozdemir/birim-fiyat-parser.git
cd birim-fiyat-parser
```

### 2. Python Sanal Ortamını Hazırlayın
```bash
python -m venv venv

# Windows:
venv\Scripts\activate
# Mac / Linux:
source venv/bin/activate

# Gerekli kütüphaneleri yükleyin:
pip install -r requirements.txt
```

### 3. Node Bağımlılıklarını Yükleyin (pnpm ile)
```bash
pnpm install
```

### 4. Geliştirme Modunda Çalıştırın
```bash
pnpm dev
# veya
pnpm start
```

---

## 📦 Üretim Derlemesi (Build)

Uygulamanın ön yüzünü derlemek için:
```bash
pnpm build
```

Windows kurulum paketini (Setup .exe ve Portable) üretmek için:
```bash
pnpm run dist
```

---

## ⚙️ GitHub Actions Entegrasyonu

- **CI (`.github/workflows/ci.yml`):** `main` veya `master` dalına yapılan her push ve pull request'te Node ve Python bağımlılıklarını kurup Vite derlemesini doğrular.
- **Release (`.github/workflows/release.yml`):** Yeni bir sürüm etiketi (örneğin `v1.0.0`) gönderildiğinde otomatik olarak Windows kurulum dosyalarını derleyip GitHub Releases bölümünde yayınlar.

---

## 📄 Lisans

MIT © [İlyas Bozdemir](https://github.com/ilyasbozdemir)
