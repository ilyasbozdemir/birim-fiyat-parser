import json
import sys
import os
import re

# Windows terminal UTF-8 desteği
try:
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    if hasattr(sys.stderr, 'reconfigure'):
        sys.stderr.reconfigure(encoding='utf-8')
except Exception:
    pass

def clean_text(text):
    if not text:
        return ""
    return re.sub(r'\s+', ' ', str(text)).strip()

def normalize_price(price_str):
    if not price_str:
        return ""
    cleaned = clean_text(price_str)
    # ₺, TL, TRY ve para birimi sembollerini temizle
    cleaned = re.sub(r'[^\d,\.]', '', cleaned)
    return cleaned

# Poz No tespiti: 10.200.3051, 15.120.1001, Y.15.001/2B, 10.100.1001/1, 04.001/01, KGM/15.001, MSB.101, vb.
POZ_REGEX = re.compile(r'^([0-9]{2,3}\.[0-9a-zA-Z\.\-\/]+|[A-ZÇĞİÖŞÜa-z]{1,10}[\.\/\-][0-9a-zA-Z\.\-\/]+)')

# Birim tespiti: m, m2, m3, kg, ton, adet, takım, saat vb.
UNIT_REGEX = re.compile(r'\b(adet|ad\.|ad|m2|m²|m3|m³|m|mt|mt\.|kg|ton|ton\.|saat|gün|takım|tk|tk\.|lt|lt\.|kwh|ay|sefer|dm3|ha|dakika|dk)\b', re.IGNORECASE)

# Satın Alma Yeri tespiti (Rayiç cetvelleri için: İşbaşında, Ocakta, Fabrikada, İşyerinde vb.)
SATIN_ALMA_REGEX = re.compile(r'\b(işbaşında|işyerinde|ocakta|fabrikada|şantiyede|depoda|piyasada|ocak başında|teslim yeri)\b', re.IGNORECASE)

# Fiyat tespiti (satır sonundaki sayı: örn 15,50 veya 1.250,00)
PRICE_REGEX = re.compile(r'([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2}|[0-9]+,[0-9]{2}|[0-9]+(?:\.[0-9]{2})?)\s*$')

# Bölüm / Grup Başlıkları (örn: 10.130.-Malzeme Rayiçleri, 1- Alüminyum, metal asma tavanlar için vb.)
CATEGORY_REGEX = re.compile(r'^(\d{2}\.\d{3}\.\-[^\n\r]+|\d+\-\s+[A-ZÇĞİÖŞÜa-z\s\,\(\)]+|BÖLÜM\s+\d+.*|KISIM\s+\d+.*)', re.IGNORECASE)

def parse_line_components(text_line):
    """
    Bir satırdan fiyat, satın alma yeri, birim ve tanımı ayrıştırır.
    """
    fiyat = ""
    satin_alma = ""
    birim = ""
    tanim = text_line

    # 1. Fiyat bul (Satır sonu)
    p_match = PRICE_REGEX.search(tanim)
    if p_match:
        fiyat = p_match.group(1)
        tanim = tanim[:p_match.start()].strip()

    # 2. Satın Alma Yeri bul (İşbaşında, Ocakta vb.)
    sa_match = SATIN_ALMA_REGEX.search(tanim)
    if sa_match:
        satin_alma = sa_match.group(1).capitalize()
        # Satın alma yerini tanımdan çıkar
        tanim = tanim[:sa_match.start()].strip() + " " + tanim[sa_match.end():].strip()
        tanim = clean_text(tanim)

    # 3. Birim bul
    u_match = UNIT_REGEX.search(tanim)
    if u_match:
        birim = u_match.group(1)
        # Birimi tanımdan temizle
        tanim = tanim[:u_match.start()].strip() + " " + tanim[u_match.end():].strip()
        tanim = clean_text(tanim)

    return clean_text(tanim), clean_text(birim), clean_text(satin_alma), normalize_price(fiyat)

def extract_with_pdfium_fast(pdf_path):
    """
    pypdfium2 ile hem standart birim fiyat hem de rayiç tablolarını ultra hızlı tarar.
    """
    import pypdfium2 as pdfium
    
    data = []
    pdf = pdfium.PdfDocument(pdf_path)
    total_pages = len(pdf)
    print(f"[PDF Engine] pypdfium2 devrede. Toplam sayfa: {total_pages}", file=sys.stderr)

    current_item = None
    current_category = ""

    for page_idx in range(total_pages):
        if (page_idx + 1) % 50 == 0 or page_idx == total_pages - 1:
            print(f"[İlerleme] Sayfa {page_idx + 1} / {total_pages} taranıyor... ({len(data)} poz bulundu)", file=sys.stderr)

        page = pdf[page_idx]
        textpage = page.get_textpage()
        text = textpage.get_text_range()

        if not text:
            continue

        lines = text.split('\n')
        for raw_line in lines:
            line = clean_text(raw_line)
            if not line:
                continue

            lower_line = line.lower()
            # Başlık satırları
            if lower_line.startswith("poz no") or ("tanımı" in lower_line and "ölçü" in lower_line):
                continue
            if "sayfa" in lower_line and len(line) < 15:
                continue
            if "t.c. çevre" in lower_line or "birim fiyat cetveli" in lower_line:
                continue
            if re.match(r'^\d{2}\.\d{2}\.\d{4}$', line):  # Sadece tarih satırları örn 01.01.2026
                continue

            # Alt grup / Bölüm başlığı tespiti (Örn: 10.130.-Malzeme Rayiçleri veya 1- Alüminyum asma tavan)
            if CATEGORY_REGEX.match(line) and not POZ_REGEX.match(line):
                current_category = line
                continue

            poz_match = POZ_REGEX.match(line)
            if poz_match:
                # Önceki pozu listeye ekle
                if current_item and current_item.get("pozNo"):
                    data.append(current_item)
                    current_item = None

                poz_no = poz_match.group(1).strip()
                if poz_no.lower() in ["poz no", "poz no.", "sıra no", "s.no", "no"]:
                    continue

                rest = line[len(poz_no):].strip()
                tanim, birim, satin_alma, fiyat = parse_line_components(rest)

                current_item = {
                    "id": len(data) + 1,
                    "pozNo": clean_text(poz_no),
                    "tanim": tanim,
                    "birim": birim or "Adet",
                    "satinAlmaYeri": satin_alma,
                    "fiyat": fiyat,
                    "kategori": current_category,
                    "sayfa": page_idx + 1
                }
            elif current_item:
                # Çok satırlı açıklama veya fiyat devamı
                c_tanim, c_birim, c_satin_alma, c_fiyat = parse_line_components(line)

                if c_fiyat and not current_item.get("fiyat"):
                    current_item["fiyat"] = c_fiyat
                if c_satin_alma and not current_item.get("satinAlmaYeri"):
                    current_item["satinAlmaYeri"] = c_satin_alma
                if c_birim and current_item.get("birim") in ["Adet", ""]:
                    current_item["birim"] = c_birim
                if c_tanim:
                    if len(current_item["tanim"]) < 600:
                        current_item["tanim"] += " " + c_tanim

    if current_item and current_item.get("pozNo"):
        data.append(current_item)

    return data, total_pages

def extract_with_pdfplumber(pdf_path):
    import pdfplumber
    data = []
    with pdfplumber.open(pdf_path) as pdf:
        total_pages = len(pdf.pages)
        for page_idx, page in enumerate(pdf.pages):
            tables = page.extract_tables()
            if tables:
                for table in tables:
                    for row in table:
                        if not row or len(row) < 2:
                            continue
                        clean_row = [clean_text(c) for c in row if c is not None]
                        if not clean_row:
                            continue
                        if clean_row[0].lower() in ["poz no", "poz no.", "sıra no", "no"]:
                            continue

                        poz_no = clean_row[0]
                        tanim = clean_row[1] if len(clean_row) > 1 else ""
                        birim = "Adet"
                        satin_alma = ""
                        fiyat = ""

                        if len(clean_row) >= 5:
                            # Rayiç tablosu: [Poz No, Tanım, Ölçü Birimi, Satın Alma Yeri, Rayiç Fiyatı]
                            birim = clean_row[2]
                            satin_alma = clean_row[3]
                            fiyat = clean_row[4]
                        elif len(clean_row) == 4:
                            # Standart tablo: [Poz No, Tanım, Birim, Fiyat]
                            birim = clean_row[2]
                            fiyat = clean_row[3]
                        elif len(clean_row) == 3:
                            birim = clean_row[2]
                            fiyat = clean_row[2]

                        if poz_no:
                            data.append({
                                "id": len(data) + 1,
                                "pozNo": clean_text(poz_no),
                                "tanim": clean_text(tanim),
                                "birim": clean_text(birim) or "Adet",
                                "satinAlmaYeri": clean_text(satin_alma),
                                "fiyat": normalize_price(fiyat),
                                "sayfa": page_idx + 1
                            })
    return data, total_pages

def extract_prices(pdf_path):
    try:
        if not os.path.exists(pdf_path):
            return {
                "error": f"Dosya bulunamadı: {pdf_path}",
                "success": False
            }

        # 1. Aşama: Ultra Hızlı Motor (pypdfium2)
        try:
            data, total_pages = extract_with_pdfium_fast(pdf_path)
            if data and len(data) > 0:
                print(f"[Başarılı] pypdfium2 ile {len(data)} poz/rayiç çıkarıldı.", file=sys.stderr)
                return {
                    "success": True,
                    "data": data,
                    "rowCount": len(data),
                    "tableCount": total_pages,
                    "message": f"{len(data)} poz ve rayiç kalemi ({total_pages} sayfadan) başarıyla ayrıştırıldı."
                }
        except Exception as e:
            print(f"[pdfium warning]: {str(e)}", file=sys.stderr)

        # 2. Aşama: pdfplumber Motoru
        try:
            data, total_pages = extract_with_pdfplumber(pdf_path)
            if data and len(data) > 0:
                print(f"[Başarılı] pdfplumber ile {len(data)} poz/rayiç çıkarıldı.", file=sys.stderr)
                return {
                    "success": True,
                    "data": data,
                    "rowCount": len(data),
                    "tableCount": total_pages,
                    "message": f"{len(data)} poz kalemi başarıyla ayrıştırıldı."
                }
        except Exception as e:
            print(f"[pdfplumber warning]: {str(e)}", file=sys.stderr)

        return {
            "error": "PDF belgesinde okunabilir birim fiyat veya rayiç tablosu bulunamadı.",
            "success": False
        }

    except Exception as e:
        return {
            "error": f"Ayrıştırma sırasında beklenmeyen hata: {str(e)}",
            "success": False
        }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({
            "error": "PDF dosya yolu belirtilmedi.",
            "success": False
        }, ensure_ascii=False))
        sys.exit(1)

    pdf_path = sys.argv[1]
    result = extract_prices(pdf_path)
    # Binary UTF-8 çıktısı
    sys.stdout.buffer.write(json.dumps(result, ensure_ascii=False, indent=2).encode('utf-8'))
    sys.stdout.buffer.flush()
