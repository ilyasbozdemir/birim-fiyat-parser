# 📄 Birim Fiyat & Rayiç Parser Pro

Birim Fiyat Parser Pro; kamu ihale, bakanlık veya özel birim fiyat cetveli PDF belgelerindeki fiyat tablolarını ve malzeme/işçilik rayiçlerini saniyeler içinde tespit edip ayrıştıran, gelişmiş arama, filtreleme, sıralama ve çoklu formatta dışa aktarma (CSV, JSON, Excel TSV) sunan modern bir **Electron Masaüstü** ve **Komut Satırı (CLI)** aracıdır.

---

## ✨ Özellikler

- **📁 Çoklu Giriş Yöntemi:**
  - **Sürükle-Bırak (Drag & Drop):** PDF dosyasını pencereye sürükleyin ve anında ayrıştırın.
  - **Dosya Seçici:** Klasik dosya seçici ile PDF yükleme.
  - **🌐 Web / URL Desteği:** Herhangi bir web sitesindeki PDF bağlantısını girerek doğrudan indirme ve parse etme.
- **⚡ Ultra Hızlı Ayrıştırma Motoru (pypdfium2 + pdfplumber):**
  - 700+ sayfalık resmi bakanlık ve kamu birim fiyat kitaplarını (20.000+ poz) **~3 saniyede** anında ayrıştırır.
  - Malzeme ve İşçilik Rayiç Cetvelleri için `Satın Alma Yeri` (İşbaşında, Fabrikada, Ocakta vb.) ve `Kategori / Bölüm` desteği.
- **💻 Güçlü Terminal / Komut Satırı (CLI) Desteği:**
  - CMD / PowerShell üzerinden doğrudan PDF veya Web URL parse edebilme, CSV/JSON/TSV kaydetme ve filtreleme.
- **🎨 Modern & Premium Arayüz:**
  - **Tailwind CSS v3:** Koyu mod (dark mode) ve cam efekti (glassmorphism).
  - **Radix UI Primitives:** Tabs, Dialog (detaylı poz önizleme), Tooltip ve Toast bildirimleri.
  - **Lucide Icons:** Zengin SVG ikon seti.
- **📊 Veri Yönetimi & Dışa Aktarma:**
  - Canlı Arama ve Poz No / Tanım / Rayiç filtreleme.
  - Artan / Azalan sütun sıralama (fiyatlar için sayısal sıralama).
  - Sayfalama (Pagination).
  - **CSV İndir** (Excel uyumlu UTF-8 BOM ile Türkçe karakter desteği).
  - **JSON İndir**.
  - **Panoya Kopyala (TSV):** Tek tıkla Excel veya Google E-Tablolar'a doğrudan yapıştırma formatı.

---

## 💻 Komut Satırı (CLI) Kullanımı

Uygulamayı grafik arayüz olmadan terminal / CMD üzerinden de doğrudan çalıştırabilirsiniz:

```bash
# 1. Yardım Menüsünü Görüntüleme
pnpm cli --help

# 2. Yerel PDF'i Ayrıştırma ve Terminalde Tablo Olarak İnceleme
pnpm cli "C:\Belgeler\2026_birim_fiyatlar.pdf"

# 3. Sonuçları CSV Olarak Kaydetme
pnpm cli "C:\Belgeler\2026_birim_fiyatlar.pdf" -o birim_fiyatlar.csv

# 4. Web URL Üzerindeki PDF'i Doğrudan Çıkarıp JSON Olarak Kaydetme
pnpm cli "https://ornek.gov.tr/fiyat_listesi.pdf" -o sonuc.json -f json

# 5. Kelime Arama & Filtreleme (Örn: "boya" içeren pozlar, ilk 20 tanesi)
pnpm cli "fiyatlar.pdf" --search "boya" --limit 20
```

### CLI Seçenekleri

| Parametre | Açıklama |
|---|---|
| `-o, --output <dosya>` | Ayrıştırılan verileri CSV, JSON veya TSV dosyası olarak kaydeder. |
| `-f, --format <format>` | Çıktı formatı: `csv` \| `json` \| `tsv` \| `table` |
| `-s, --search <kelime>` | Poz no, açıklama veya kategoriye göre anlık filtreleme yapar. |
| `-l, --limit <sayı>` | Konsolda listelenecek satır sayısı (Varsayılan: 30). |
| `-q, --quiet` | Başlıkları gizler, sadece saf JSON çıktısı üretir (Script entegrasyonu için). |
| `-h, --help` | Yardım menüsünü görüntüler. |

---

## 🖥️ Masaüstü Uygulaması Olarak Çalıştırma

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

### 4. Geliştirme Modunda Çalıştırın (Electron + Canlı Yenileme)
```bash
pnpm dev
```

---

## 📦 Üretim Derlemesi (Build)

Uygulamanın masaüstü kurulum paketini (`.exe` ve Portable) üretmek için:
```bash
pnpm run dist
```

---

## 📄 Lisans

MIT © [İlyas Bozdemir](https://github.com/ilyasbozdemir)
