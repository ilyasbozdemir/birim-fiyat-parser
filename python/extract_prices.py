import camelot
import json
import sys
import os
import re

def clean_text(text):
    if not text or text is None:
        return ""
    # Birden fazla boşluk veya alt satırları temizle
    return re.sub(r'\s+', ' ', str(text)).strip()

def normalize_price(price_str):
    if not price_str:
        return ""
    cleaned = clean_text(price_str)
    # TL, ₺, TRY gibi ibareleri temizle
    cleaned = re.sub(r'[^\d,\.]', '', cleaned)
    return cleaned

def extract_prices(pdf_path):
    try:
        if not os.path.exists(pdf_path):
            return {
                "error": f"Dosya bulunamadı: {pdf_path}",
                "success": False
            }

        # Önce 'lattice' (çizgili tablolar) dene, tablo çıkmazsa 'stream' modunu dene
        tables = []
        try:
            tables = camelot.read_pdf(pdf_path, pages='all', flavor='lattice')
        except Exception as e:
            pass

        if not tables or len(tables) == 0:
            try:
                tables = camelot.read_pdf(pdf_path, pages='all', flavor='stream')
            except Exception as e:
                return {
                    "error": f"PDF okuma hatası: {str(e)}",
                    "success": False
                }

        if not tables or len(tables) == 0:
            return {
                "error": "PDF içerisinde okunabilir birim fiyat tablosu bulunamadı.",
                "success": False
            }

        data = []
        total_pages = len(tables)

        for table_idx, table in enumerate(tables):
            df = table.df
            if df.empty or len(df.columns) < 2:
                continue

            num_cols = len(df.columns)

            for row_idx, row in df.iterrows():
                # İlk satır genellikle başlıktır
                row_vals = [clean_text(val) for val in row.values]
                joined_row = " ".join(row_vals).lower()

                # Başlık satırlarını tespit et ve atla
                if "poz" in joined_row and ("tanım" in joined_row or "tanim" in joined_row or "fiyat" in joined_row or "birim" in joined_row):
                    continue

                poz_no = ""
                tanim = ""
                birim = ""
                fiyat = ""

                if num_cols >= 4:
                    poz_no = row_vals[0]
                    tanim = row_vals[1]
                    birim = row_vals[2]
                    fiyat = row_vals[3]
                elif num_cols == 3:
                    poz_no = row_vals[0]
                    tanim = row_vals[1]
                    fiyat = row_vals[2]
                elif num_cols == 2:
                    poz_no = row_vals[0]
                    tanim = row_vals[1]

                # Temizlik
                poz_no = clean_text(poz_no)
                tanim = clean_text(tanim)
                birim = clean_text(birim)
                fiyat = normalize_price(fiyat)

                # Boş satırları veya tek karakterli anlamsız satırları atla
                if not poz_no and not tanim:
                    continue

                if poz_no.lower() in ["poz no", "poz no.", "sıra no", "s.no", "no"]:
                    continue

                data.append({
                    "id": len(data) + 1,
                    "pozNo": poz_no,
                    "tanim": tanim,
                    "birim": birim or "Adet",
                    "fiyat": fiyat
                })

        if len(data) == 0:
            return {
                "error": "Tablolardan geçerli birim fiyat verisi ayrıştırılamadı.",
                "success": False
            }

        return {
            "success": True,
            "data": data,
            "rowCount": len(data),
            "tableCount": len(tables),
            "message": f"{len(data)} satır başarıyla çıkartıldı."
        }

    except Exception as e:
        return {
            "error": f"Beklenmeyen bir hata oluştu: {str(e)}",
            "success": False
        }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({
            "error": "PDF dosya yolu veya parametre eksik.",
            "success": False
        }, ensure_ascii=False))
        sys.exit(1)

    pdf_path = sys.argv[1]
    result = extract_prices(pdf_path)
    print(json.dumps(result, ensure_ascii=False, indent=2))
