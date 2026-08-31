import json
import sys
import os
import re

def clean_text(text):
    if not text:
        return ""
    return re.sub(r'\s+', ' ', str(text)).strip()

def normalize_price(price_str):
    if not price_str:
        return ""
    cleaned = clean_text(price_str)
    # TL, ₺, TRY gibi ibareleri temizle
    cleaned = re.sub(r'[^\d,\.]', '', cleaned)
    return cleaned

def extract_with_pdfplumber(pdf_path):
    import pdfplumber
    data = []
    table_count = 0

    # Poz no tespiti için regex: örn. 15.120.1001 veya 10.100.1001/1 vb.
    poz_pattern = re.compile(r'^(\d{2,3}[\.\/][0-9a-zA-Z\.\-\/]+)')
    # Birim tespiti: m, m2, m3, kg, ton, adet, ad, vb.
    unit_pattern = re.compile(r'\b(adet|ad\.|ad|m2|m²|m3|m³|m|mt|kg|ton|ton\.|saat|gün|takım|tk|lt|kwh|ay|sefer)\b', re.IGNORECASE)

    with pdfplumber.open(pdf_path) as pdf:
        total_pages = len(pdf.pages)
        print(f"[pdfplumber] Toplam sayfa sayısı: {total_pages}", file=sys.stderr)

        for page_idx, page in enumerate(pdf.pages):
            # 1. Yöntem: Tablo olarak çıkar
            tables = page.extract_tables()
            if tables:
                for table in tables:
                    table_count += 1
                    for row in table:
                        if not row or len(row) < 2:
                            continue
                        
                        clean_row = [clean_text(cell) for cell in row if cell is not None]
                        if not clean_row:
                            continue

                        joined = " ".join(clean_row).lower()
                        # Başlık satırlarını atla
                        if "poz" in joined and ("tanım" in joined or "tanim" in joined or "açıklama" in joined or "fiyat" in joined):
                            continue

                        poz_no = ""
                        tanim = ""
                        birim = ""
                        fiyat = ""

                        # Sütun sayısına göre eşle
                        if len(clean_row) >= 4:
                            poz_no = clean_row[0]
                            tanim = clean_row[1]
                            birim = clean_row[2]
                            fiyat = clean_row[3]
                        elif len(clean_row) == 3:
                            poz_no = clean_row[0]
                            tanim = clean_row[1]
                            fiyat = clean_row[2]
                        elif len(clean_row) == 2:
                            poz_no = clean_row[0]
                            tanim = clean_row[1]

                        poz_no = clean_text(poz_no)
                        tanim = clean_text(tanim)
                        birim = clean_text(birim)
                        fiyat = normalize_price(fiyat)

                        # Geçerli poz satırı kontrolü
                        if poz_no and poz_no.lower() not in ["poz no", "poz no.", "sıra no", "s.no", "no"]:
                            data.append({
                                "id": len(data) + 1,
                                "pozNo": poz_no,
                                "tanim": tanim,
                                "birim": birim or "Adet",
                                "fiyat": fiyat,
                                "sayfa": page_idx + 1
                            })

            # 2. Yöntem: Eğer tabloda satır bulunamadıysa metin satırlarını tara
            if not tables or len(data) == 0:
                text = page.extract_text()
                if text:
                    for line in text.split('\n'):
                        line = line.strip()
                        if not line:
                            continue
                        
                        match = poz_pattern.match(line)
                        if match:
                            poz_no = match.group(1)
                            rest = line[len(poz_no):].strip()
                            
                            # Fiyat genellikle satır sonundaki sayıdır (örn: 1.250,50)
                            price_match = re.search(r'([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2}|[0-9]+(?:\.[0-9]{2})?)\s*$', rest)
                            fiyat = ""
                            tanim_birim = rest
                            if price_match:
                                fiyat = price_match.group(1)
                                tanim_birim = rest[:price_match.start()].strip()

                            # Birim tespiti
                            u_match = unit_pattern.search(tanim_birim)
                            birim = "Adet"
                            tanim = tanim_birim
                            if u_match:
                                birim = u_match.group(1)
                                tanim = tanim_birim[:u_match.start()].strip() + " " + tanim_birim[u_match.end():].strip()

                            if poz_no and tanim:
                                data.append({
                                    "id": len(data) + 1,
                                    "pozNo": clean_text(poz_no),
                                    "tanim": clean_text(tanim),
                                    "birim": clean_text(birim),
                                    "fiyat": normalize_price(fiyat),
                                    "sayfa": page_idx + 1
                                })

    return data, max(table_count, 1)

def extract_prices(pdf_path):
    try:
        if not os.path.exists(pdf_path):
            return {
                "error": f"Dosya bulunamadı: {pdf_path}",
                "success": False
            }

        # 1. Hızlı ve Güvenilir Motor: pdfplumber
        try:
            data, table_count = extract_with_pdfplumber(pdf_path)
            if data and len(data) > 0:
                return {
                    "success": True,
                    "data": data,
                    "rowCount": len(data),
                    "tableCount": table_count,
                    "message": f"{len(data)} satır başarıyla çıkartıldı (pdfplumber)."
                }
        except Exception as e:
            print(f"[pdfplumber error]: {str(e)}", file=sys.stderr)

        # 2. Yedek Motor: Camelot
        try:
            import camelot
            tables = camelot.read_pdf(pdf_path, pages='1-30', flavor='lattice')
            if not tables:
                tables = camelot.read_pdf(pdf_path, pages='1-30', flavor='stream')

            if tables:
                data = []
                for table in tables:
                    df = table.df
                    for _, row in df.iterrows():
                        row_vals = [clean_text(v) for v in row.values]
                        if len(row_vals) >= 2:
                            data.append({
                                "id": len(data) + 1,
                                "pozNo": row_vals[0],
                                "tanim": row_vals[1] if len(row_vals) > 1 else "",
                                "birim": row_vals[2] if len(row_vals) > 2 else "Adet",
                                "fiyat": normalize_price(row_vals[3]) if len(row_vals) > 3 else ""
                            })
                if len(data) > 0:
                    return {
                        "success": True,
                        "data": data,
                        "rowCount": len(data),
                        "tableCount": len(tables),
                        "message": f"{len(data)} satır başarıyla çıkartıldı (camelot)."
                    }
        except Exception as e:
            print(f"[camelot error]: {str(e)}", file=sys.stderr)

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
    print(json.dumps(result, ensure_ascii=False, indent=2))
