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

# Poz No tespiti: 15.120.1001, Y.15.001/2B, 10.100.1001/1, 04.001/01, KGM/15.001, MSB.101 vb.
POZ_REGEX = re.compile(r'^([0-9]{2,3}\.[0-9a-zA-Z\.\-\/]+|[A-ZÇĞİÖŞÜa-z]{1,10}[\.\/\-][0-9a-zA-Z\.\-\/]+)')
# Birim tespiti
UNIT_REGEX = re.compile(r'\b(adet|ad\.|ad|m2|m²|m3|m³|m|mt|mt\.|kg|ton|ton\.|saat|gün|takım|tk|tk\.|lt|lt\.|kwh|ay|sefer|dm3|ha)\b', re.IGNORECASE)
# Fiyat tespiti (satır sonundaki sayı)
PRICE_REGEX = re.compile(r'([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2}|[0-9]+,[0-9]{2}|[0-9]+(?:\.[0-9]{2})?)\s*$')

def extract_with_pdfium_fast(pdf_path):
    """
    pypdfium2 (C++ Chromium PDF engine) ile 700+ sayfayı 1-2 saniyede ultra hızlı tarar.
    """
    import pypdfium2 as pdfium
    
    data = []
    pdf = pdfium.PdfDocument(pdf_path)
    total_pages = len(pdf)
    print(f"[PDF Engine] pypdfium2 devrede. Toplam sayfa: {total_pages}", file=sys.stderr)

    current_item = None

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
            # Başlık ve sayfa altı / üstü ibarelerini atla
            if "bölüm" in lower_line and "poz" in lower_line:
                continue
            if "sayfa" in lower_line and len(line) < 15:
                continue
            if "birim fiyat cetveli" in lower_line or "t.c. çevre" in lower_line:
                continue

            poz_match = POZ_REGEX.match(line)
            if poz_match:
                # Önceki yarım kalan pozu kaydet
                if current_item and current_item.get("pozNo"):
                    data.append(current_item)
                    current_item = None

                poz_no = poz_match.group(1).strip()
                # Poz no başlık ise atla
                if poz_no.lower() in ["poz no", "poz no.", "sıra no", "s.no", "no"]:
                    continue

                rest = line[len(poz_no):].strip()

                price_match = PRICE_REGEX.search(rest)
                fiyat = ""
                tanim_birim = rest
                if price_match:
                    fiyat = price_match.group(1)
                    tanim_birim = rest[:price_match.start()].strip()

                unit_match = UNIT_REGEX.search(tanim_birim)
                birim = "Adet"
                tanim = tanim_birim
                if unit_match:
                    birim = unit_match.group(1)
                    tanim = tanim_birim[:unit_match.start()].strip() + " " + tanim_birim[unit_match.end():].strip()

                current_item = {
                    "id": len(data) + 1,
                    "pozNo": clean_text(poz_no),
                    "tanim": clean_text(tanim),
                    "birim": clean_text(birim) or "Adet",
                    "fiyat": normalize_price(fiyat),
                    "sayfa": page_idx + 1
                }
            elif current_item:
                # Çok satırlı açıklama devamı
                price_match = PRICE_REGEX.search(line)
                if price_match and not current_item.get("fiyat"):
                    current_item["fiyat"] = normalize_price(price_match.group(1))
                    remaining = line[:price_match.start()].strip()
                    unit_match = UNIT_REGEX.search(remaining)
                    if unit_match and current_item.get("birim") == "Adet":
                        current_item["birim"] = clean_text(unit_match.group(1))
                        remaining = remaining[:unit_match.start()].strip() + " " + remaining[unit_match.end():].strip()
                    if remaining:
                        current_item["tanim"] += " " + clean_text(remaining)
                else:
                    # Açıklamaya ekle
                    unit_match = UNIT_REGEX.search(line)
                    if unit_match and current_item.get("birim") == "Adet" and not current_item.get("fiyat"):
                        current_item["birim"] = clean_text(unit_match.group(1))
                        cleaned_line = line[:unit_match.start()].strip() + " " + line[unit_match.end():].strip()
                        if cleaned_line:
                            current_item["tanim"] += " " + clean_text(cleaned_line)
                    else:
                        if len(current_item["tanim"]) < 500:
                            current_item["tanim"] += " " + line

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
                        birim = clean_row[2] if len(clean_row) > 2 else "Adet"
                        fiyat = clean_row[3] if len(clean_row) > 3 else ""
                        if poz_no:
                            data.append({
                                "id": len(data) + 1,
                                "pozNo": clean_text(poz_no),
                                "tanim": clean_text(tanim),
                                "birim": clean_text(birim) or "Adet",
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
                print(f"[Başarılı] pypdfium2 ile {len(data)} poz çıkarıldı.", file=sys.stderr)
                return {
                    "success": True,
                    "data": data,
                    "rowCount": len(data),
                    "tableCount": total_pages,
                    "message": f"{len(data)} poz kalemi ({total_pages} sayfadan) başarıyla ayrıştırıldı."
                }
        except Exception as e:
            print(f"[pdfium warning]: {str(e)}", file=sys.stderr)

        # 2. Aşama: pdfplumber Motoru
        try:
            data, total_pages = extract_with_pdfplumber(pdf_path)
            if data and len(data) > 0:
                print(f"[Başarılı] pdfplumber ile {len(data)} poz çıkarıldı.", file=sys.stderr)
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
            "error": "PDF belgesinde okunabilir birim fiyat tablosu veya poz kalemleri bulunamadı.",
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
    # Binary UTF-8 yazımı ile Windows cp1254 encoding çökmesini engelle
    sys.stdout.buffer.write(json.dumps(result, ensure_ascii=False, indent=2).encode('utf-8'))
    sys.stdout.buffer.flush()
