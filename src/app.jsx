import React, { useState, useMemo } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import * as Dialog from '@radix-ui/react-dialog';
import * as Tooltip from '@radix-ui/react-tooltip';
import * as Toast from '@radix-ui/react-toast';
import { 
  FileText, 
  UploadCloud, 
  Link as LinkIcon, 
  Download, 
  Search, 
  Sparkles, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Copy, 
  FileSpreadsheet, 
  ArrowUpDown, 
  ChevronLeft, 
  ChevronRight, 
  X,
  FileCode2,
  Table as TableIcon,
  Layers,
  Check,
  Terminal,
  MapPin,
  Tag,
  CheckSquare,
  Square,
  ListFilter,
  Trash2,
  Calculator,
  PlusCircle,
  FileSearch,
  ShoppingCart
} from 'lucide-react';

export default function App() {
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [data, setData] = useState(null);
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState(null);
  const [sourceName, setSourceName] = useState(null);
  
  // URL Input State
  const [pdfUrl, setPdfUrl] = useState('');
  
  // Drag & Drop State
  const [isDragging, setIsDragging] = useState(false);

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [showOnlySelected, setShowOnlySelected] = useState(false);
  const [sortField, setSortField] = useState('pozNo');
  const [sortDirection, setSortDirection] = useState('asc'); // 'asc' | 'desc'
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  // Selected Items State (Cımbızla Seçim Sepeti)
  // Map of id -> item
  const [selectedMap, setSelectedMap] = useState({});
  // Quantities for each selected item: id -> number
  const [quantities, setQuantities] = useState({});

  // Selected Item for Preview Modal
  const [selectedItem, setSelectedItem] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Batch Poz Match Dialog (Toplu Poz Yapıştırma)
  const [isBatchDialogOpen, setIsBatchDialogOpen] = useState(false);
  const [batchInput, setBatchInput] = useState('');

  // Toast Notification
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const triggerToast = (msg) => {
    setToastMsg(msg);
    setToastOpen(false);
    setTimeout(() => setToastOpen(true), 50);
  };

  // 1. PDF Dosyası Seç (Dialog ile)
  const handleSelectPdf = async () => {
    setLoading(true);
    setLoadingMessage('PDF seçiliyor...');
    setError(null);
    
    try {
      if (!window.api?.selectPdf) {
        throw new Error('Electron API köprüsü aktif değil.');
      }

      const filePath = await window.api.selectPdf();
      if (!filePath) {
        setLoading(false);
        return;
      }

      const name = filePath.split(/[\\/]/).pop();
      setSourceName(name);
      setLoadingMessage('Tablolar taranıyor ve parse ediliyor...');

      const result = await window.api.extractPrices(filePath);
      handleParseResult(result, name);
    } catch (err) {
      setError('Hata: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // 2. Sürükle Bırak İşleyicisi
  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);

    if (!e.dataTransfer.files || e.dataTransfer.files.length === 0) return;

    const file = e.dataTransfer.files[0];
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Lütfen yalnızca geçerli bir .pdf dosyası bırakın.');
      return;
    }

    setLoading(true);
    setLoadingMessage('Sürüklenen dosya işleniyor...');
    setError(null);
    setSourceName(file.name);

    try {
      const filePath = file.path;
      if (!filePath) {
        throw new Error('Dosya yolu okunamadı. Lütfen "PDF Seç" butonunu kullanın.');
      }

      const result = await window.api.extractPrices(filePath);
      handleParseResult(result, file.name);
    } catch (err) {
      setError('Hata: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // 3. URL ile PDF Parse Et
  const handleUrlSubmit = async (e) => {
    e.preventDefault();
    if (!pdfUrl || !pdfUrl.trim().startsWith('http')) {
      setError('Lütfen geçerli bir http/https PDF bağlantısı girin.');
      return;
    }

    setLoading(true);
    setLoadingMessage('PDF indiriliyor ve tablolar taranıyor...');
    setError(null);
    const urlName = pdfUrl.split('/').pop().split('?')[0] || 'Web PDF Belgesi';
    setSourceName(urlName);

    try {
      if (!window.api?.extractFromUrl) {
        throw new Error('URL ile indirme fonksiyonu bulunamadı.');
      }

      const result = await window.api.extractFromUrl(pdfUrl.trim());
      handleParseResult(result, urlName);
    } catch (err) {
      setError('Hata: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleParseResult = (result, name) => {
    console.log('[API Result]:', result);
    if (!result) {
      console.error('[API Error]: Boş yanıt döndü');
      setError('Sonuç alınamadı.');
      return;
    }
    if (result.error || !result.success) {
      console.error('[API Extract Error]:', result.error);
      setError(result.error || 'Ayrıştırma başarısız oldu.');
      setData(null);
    } else {
      console.log(`[API Extract Success]: ${result.data?.length} satır verisi`, result.data);
      setData(result.data || []);
      setMeta({
        rowCount: result.rowCount || (result.data ? result.data.length : 0),
        tableCount: result.tableCount || 1,
      });
      setSelectedMap({});
      setQuantities({});
      setCurrentPage(1);
      triggerToast(`✅ ${result.data?.length || 0} satır başarıyla ayrıştırıldı!`);
    }
  };

  // Tabloda Satın Alma Yeri (Rayiç) var mı?
  const hasSatinAlmaYeri = useMemo(() => {
    return data && data.some(d => d.satinAlmaYeri && d.satinAlmaYeri.trim() !== '');
  }, [data]);

  // Sayısal Fiyat Yardımcısı
  const parseNumericPrice = (priceStr) => {
    if (!priceStr) return 0;
    const clean = String(priceStr).replace(/\./g, '').replace(',', '.');
    return parseFloat(clean) || 0;
  };

  // Tekli Seçim Toggle (Cımbızla Alma)
  const toggleSelectPoz = (row) => {
    setSelectedMap(prev => {
      const next = { ...prev };
      if (next[row.id]) {
        delete next[row.id];
      } else {
        next[row.id] = row;
        if (!quantities[row.id]) {
          setQuantities(q => ({ ...q, [row.id]: 1 }));
        }
      }
      return next;
    });
  };

  // Tüm Sayfayı Seç / Kaldır
  const toggleSelectAllCurrentPage = () => {
    const allPageSelected = paginatedData.every(row => !!selectedMap[row.id]);
    setSelectedMap(prev => {
      const next = { ...prev };
      paginatedData.forEach(row => {
        if (allPageSelected) {
          delete next[row.id];
        } else {
          next[row.id] = row;
        }
      });
      return next;
    });
  };

  // Tüm Filtrelenenleri Seç
  const selectAllFiltered = () => {
    setSelectedMap(prev => {
      const next = { ...prev };
      filteredAndSortedData.forEach(row => {
        next[row.id] = row;
      });
      return next;
    });
    triggerToast(`📌 Filtrelenen ${filteredAndSortedData.length} poz sepete eklendi!`);
  };

  // Seçimi Temizle
  const clearSelection = () => {
    setSelectedMap({});
    setQuantities({});
    triggerToast('Tüm seçimler temizlendi.');
  };

  // Toplu Poz No Yapıştırarak Bul & Ekle (Cımbızlama)
  const handleBatchPozMatch = () => {
    if (!data || !batchInput.trim()) return;

    // Virgül, boşluk, noktalı virgül veya alt satırlarla ayrılmış poz numaraları
    const targetCodes = batchInput
      .split(/[\n,;]+/)
      .map(c => c.trim().toLowerCase())
      .filter(c => c.length > 0);

    let addedCount = 0;
    const newSelected = { ...selectedMap };

    targetCodes.forEach(code => {
      const found = data.find(item => item.pozNo && item.pozNo.toLowerCase() === code);
      if (found) {
        newSelected[found.id] = found;
        addedCount++;
      }
    });

    setSelectedMap(newSelected);
    setIsBatchDialogOpen(false);
    setBatchInput('');
    triggerToast(`🎯 Yapıştırılan listeden ${addedCount} poz başarıyla bulundu ve sepete eklendi!`);
  };

  // Seçili Liste Dizisi
  const selectedList = useMemo(() => Object.values(selectedMap), [selectedMap]);

  // Seçilen Pozların Toplam Yaklaşık Maliyeti
  const selectedGrandTotal = useMemo(() => {
    return selectedList.reduce((sum, item) => {
      const unitPrice = parseNumericPrice(item.fiyat);
      const qty = quantities[item.id] || 1;
      return sum + (unitPrice * qty);
    }, 0);
  }, [selectedList, quantities]);

  // Tablo Filtreleme ve Sıralama
  const filteredAndSortedData = useMemo(() => {
    if (!data) return [];
    
    let list = data.filter(item => {
      if (showOnlySelected && !selectedMap[item.id]) {
        return false;
      }
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        (item.pozNo && item.pozNo.toLowerCase().includes(term)) ||
        (item.tanim && item.tanim.toLowerCase().includes(term)) ||
        (item.birim && item.birim.toLowerCase().includes(term)) ||
        (item.satinAlmaYeri && item.satinAlmaYeri.toLowerCase().includes(term)) ||
        (item.kategori && item.kategori.toLowerCase().includes(term)) ||
        (item.fiyat && item.fiyat.toLowerCase().includes(term))
      );
    });

    list.sort((a, b) => {
      let valA = a[sortField] || '';
      let valB = b[sortField] || '';

      if (sortField === 'fiyat') {
        const numA = parseNumericPrice(valA);
        const numB = parseNumericPrice(valB);
        return sortDirection === 'asc' ? numA - numB : numB - numA;
      }

      const cmp = String(valA).localeCompare(String(valB), 'tr');
      return sortDirection === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [data, searchTerm, showOnlySelected, selectedMap, sortField, sortDirection]);

  // Sayfalama
  const totalPages = Math.ceil(filteredAndSortedData.length / pageSize) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAndSortedData.slice(start, start + pageSize);
  }, [filteredAndSortedData, currentPage, pageSize]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Dışa Aktarma: CSV (Tüm Liste veya Sadece Seçilenler)
  const exportToCSV = (onlySelected = false) => {
    const exportData = onlySelected ? selectedList : data;
    if (!exportData || exportData.length === 0) {
      triggerToast('Aktarılacak veri bulunamadı.');
      return;
    }
    
    const headers = ['Poz No', 'Tanım', 'Birim'];
    if (hasSatinAlmaYeri) headers.push('Satın Alma Yeri');
    headers.push('Birim Fiyat (TL)');
    if (onlySelected) {
      headers.push('Miktar (Metraj)');
      headers.push('Toplam Tutar (TL)');
    }
    headers.push('Kategori / Bölüm');

    const csvContent = [
      headers,
      ...exportData.map(row => {
        const r = [row.pozNo || '', row.tanim || '', row.birim || ''];
        if (hasSatinAlmaYeri) r.push(row.satinAlmaYeri || '');
        r.push(row.fiyat || '');
        if (onlySelected) {
          const qty = quantities[row.id] || 1;
          const total = (parseNumericPrice(row.fiyat) * qty).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          r.push(qty);
          r.push(total);
        }
        r.push(row.kategori || '');
        return r;
      })
    ]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = onlySelected ? `secilen_pozlar_${Date.now()}.csv` : `birim_fiyatlar_${Date.now()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    triggerToast(onlySelected ? `📥 ${exportData.length} seçili poz CSV olarak indirildi.` : '📥 Tüm liste CSV olarak indirildi.');
  };

  // Panoya Kopyala (Excel Uygun TSV - Seçilenler veya Tümü)
  const copyToClipboard = (onlySelected = false) => {
    const exportData = onlySelected ? selectedList : data;
    if (!exportData || exportData.length === 0) {
      triggerToast('Kopyalanacak poz bulunamadı.');
      return;
    }

    const headers = ['Poz No', 'Tanım', 'Birim'];
    if (hasSatinAlmaYeri) headers.push('Satın Alma Yeri');
    headers.push('Birim Fiyat (TL)');
    if (onlySelected) {
      headers.push('Miktar');
      headers.push('Toplam Tutar (TL)');
    }

    const tsv = [
      headers.join('\t'),
      ...exportData.map(row => {
        const r = [row.pozNo || '', row.tanim || '', row.birim || ''];
        if (hasSatinAlmaYeri) r.push(row.satinAlmaYeri || '');
        r.push(row.fiyat || '');
        if (onlySelected) {
          const qty = quantities[row.id] || 1;
          const total = (parseNumericPrice(row.fiyat) * qty).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          r.push(qty);
          r.push(total);
        }
        return r.join('\t');
      })
    ].join('\n');

    navigator.clipboard.writeText(tsv);
    triggerToast(onlySelected ? `📋 ${exportData.length} seçili poz Excel formatında kopyalandı!` : '📋 Tablo Excel uyumlu kopyalandı!');
  };

  // Dışa Aktarma: JSON
  const exportToJSON = (onlySelected = false) => {
    const exportData = onlySelected ? selectedList : data;
    if (!exportData || exportData.length === 0) return;
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = onlySelected ? `secilen_pozlar_${Date.now()}.json` : `birim_fiyatlar_${Date.now()}.json`;
    a.click();
    window.URL.revokeObjectURL(url);
    triggerToast('📥 JSON dosyası indirildi.');
  };

  return (
    <Tooltip.Provider>
      <Toast.Provider swipeDirection="right">
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center p-4 md:p-8 pb-32">
          
          {/* Header */}
          <header className="w-full max-w-6xl mb-8 flex flex-col md:flex-row items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-lg shadow-indigo-500/20 ring-1 ring-white/20">
                <FileSpreadsheet className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-indigo-200 to-purple-400">
                  Birim Fiyat & Rayiç Parser <span className="text-xs uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">Pro</span>
                </h1>
                <p className="text-sm text-slate-400">
                  Pozları arayın, cımbızla seçin, metraj hesaplayın ve Excel'e anında aktarın
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => window.api?.toggleDevTools?.()}
                className="px-3 py-2 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 rounded-xl transition flex items-center gap-1.5 shadow-sm"
                title="Geliştirici Konsolunu (F12) Aç/Kapat"
              >
                <Terminal className="w-4 h-4 text-indigo-400" />
                F12 Konsol
              </button>

              {data && data.length > 0 && (
                <>
                  <button
                    onClick={() => setIsBatchDialogOpen(true)}
                    className="px-3 py-2 text-xs font-semibold bg-indigo-950/80 hover:bg-indigo-900/80 text-indigo-300 border border-indigo-700/60 rounded-xl transition flex items-center gap-1.5 shadow-sm"
                    title="Excel veya metinden toplu poz numaraları yapıştırarak anında sepete ekleyin"
                  >
                    <FileSearch className="w-4 h-4 text-indigo-400" />
                    Toplu Poz Bul & Ekle
                  </button>

                  <Tooltip.Root>
                    <Tooltip.Trigger asChild>
                      <button
                        onClick={() => copyToClipboard(false)}
                        className="px-3 py-2 text-sm font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl transition flex items-center gap-2 shadow-sm"
                      >
                        <Copy className="w-4 h-4 text-indigo-400" />
                        Tümünü Kopyala
                      </button>
                    </Tooltip.Trigger>
                    <Tooltip.Content className="bg-slate-800 text-white text-xs px-2.5 py-1.5 rounded-md border border-slate-700 shadow-xl">
                      Tüm tabloyu Excel'e doğrudan yapıştırmak için TSV formatında kopyalar
                    </Tooltip.Content>
                  </Tooltip.Root>

                  <button
                    onClick={() => exportToCSV(false)}
                    className="px-4 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition flex items-center gap-2 shadow-lg shadow-emerald-600/20"
                  >
                    <Download className="w-4 h-4" />
                    Tümünü CSV İndir
                  </button>
                </>
              )}
            </div>
          </header>

          <main className="w-full max-w-6xl space-y-6">
            
            {/* Input Selection Tabs (Radix Tabs) */}
            <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 shadow-2xl">
              <Tabs.Root defaultValue="upload" className="w-full">
                <Tabs.List className="flex border-b border-slate-800/80 mb-6 gap-2">
                  <Tabs.Trigger
                    value="upload"
                    className="flex items-center gap-2 px-5 py-2.5 font-medium text-sm text-slate-400 data-[state=active]:text-indigo-400 data-[state=active]:border-b-2 data-[state=active]:border-indigo-500 transition outline-none"
                  >
                    <UploadCloud className="w-4 h-4" />
                    PDF Dosyası & Sürükle-Bırak
                  </Tabs.Trigger>
                  
                  <Tabs.Trigger
                    value="url"
                    className="flex items-center gap-2 px-5 py-2.5 font-medium text-sm text-slate-400 data-[state=active]:text-indigo-400 data-[state=active]:border-b-2 data-[state=active]:border-indigo-500 transition outline-none"
                  >
                    <LinkIcon className="w-4 h-4" />
                    PDF URL İle Getir
                  </Tabs.Trigger>
                </Tabs.List>

                {/* Tab 1: Dosya Seç & Drag-and-Drop */}
                <Tabs.Content value="upload" className="outline-none focus:ring-0">
                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    className={`relative border-2 border-dashed rounded-2xl p-8 md:p-12 text-center transition-all duration-200 flex flex-col items-center justify-center cursor-pointer ${
                      isDragging 
                        ? 'border-indigo-500 bg-indigo-500/10 scale-[1.01]' 
                        : 'border-slate-700/80 bg-slate-950/40 hover:border-slate-600 hover:bg-slate-900/50'
                    }`}
                    onClick={handleSelectPdf}
                  >
                    <div className="p-4 bg-indigo-500/10 text-indigo-400 rounded-full mb-4 ring-1 ring-indigo-500/20">
                      <UploadCloud className="w-10 h-10 animate-pulse-subtle" />
                    </div>

                    <h3 className="text-lg font-semibold text-slate-100 mb-1">
                      {isDragging ? 'PDF dosyasını buraya bırakın!' : 'PDF dosyanızı seçin veya buraya sürükleyin'}
                    </h3>
                    <p className="text-sm text-slate-400 max-w-md mb-6">
                      Bakanlık, Kamu İhale, Yapı Birim Fiyat veya Malzeme/İşçilik Rayiç PDF belgelerini anında tarayın
                    </p>

                    <button
                      type="button"
                      disabled={loading}
                      onClick={(e) => { e.stopPropagation(); handleSelectPdf(); }}
                      className="px-6 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-medium rounded-xl shadow-lg shadow-indigo-500/25 transition flex items-center gap-2 text-sm disabled:opacity-50"
                    >
                      {loading ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          {loadingMessage || 'İşleniyor...'}
                        </>
                      ) : (
                        <>
                          <FileText className="w-4 h-4" />
                          Bilgisayardan PDF Seç
                        </>
                      )}
                    </button>
                  </div>
                </Tabs.Content>

                {/* Tab 2: URL Desteği */}
                <Tabs.Content value="url" className="outline-none focus:ring-0">
                  <form onSubmit={handleUrlSubmit} className="space-y-4 max-w-2xl mx-auto py-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                        PDF Web Bağlantısı (URL)
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                          <LinkIcon className="w-4 h-4" />
                        </div>
                        <input
                          type="url"
                          required
                          value={pdfUrl}
                          onChange={(e) => setPdfUrl(e.target.value)}
                          placeholder="https://ornek.gov.tr/fiyat-listesi-2026.pdf"
                          className="w-full pl-10 pr-4 py-3 bg-slate-950/60 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition text-sm"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading || !pdfUrl}
                      className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold rounded-xl shadow-lg shadow-indigo-500/20 transition flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                    >
                      {loading ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          {loadingMessage || 'İndiriliyor & Ayrıştırılıyor...'}
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          URL'den PDF Çıkar ve Parse Et
                        </>
                      )}
                    </button>
                  </form>
                </Tabs.Content>
              </Tabs.Root>

              {/* Aktif Dosya / Hata Bildirimleri */}
              {sourceName && (
                <div className="mt-4 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                  <span className="flex items-center gap-1.5 text-indigo-300 font-medium">
                    <FileText className="w-3.5 h-3.5" />
                    Kaynak: {sourceName}
                  </span>
                  {data && (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Ayrıştırma Tamamlandı ({data.length} Kalem)
                    </span>
                  )}
                </div>
              )}

              {error && (
                <div className="mt-4 p-4 rounded-xl bg-red-950/40 border border-red-800/60 text-red-300 text-sm flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <strong className="font-semibold block mb-0.5">İşlem Başarısız Oldu</strong>
                    <p className="text-xs text-red-200/80 whitespace-pre-wrap">{error}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Stats Cards */}
            {data && data.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 flex items-center gap-4">
                  <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl">
                    <TableIcon className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-white">{data.length}</div>
                    <div className="text-xs text-slate-400">Toplam Poz / Rayiç</div>
                  </div>
                </div>

                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 flex items-center gap-4">
                  <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
                    <Check className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-white">
                      {data.filter(d => d.fiyat && d.fiyat !== '').length}
                    </div>
                    <div className="text-xs text-slate-400">Fiyatı Bulunan Kalem</div>
                  </div>
                </div>

                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 flex items-center gap-4">
                  <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl">
                    <ShoppingCart className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-amber-300">{selectedList.length}</div>
                    <div className="text-xs text-slate-400">Seçili (Cımbızlanan) Poz</div>
                  </div>
                </div>

                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 flex items-center gap-4">
                  <div className="p-3 bg-purple-500/10 text-purple-400 rounded-xl">
                    <Layers className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-white">{meta?.tableCount || 1}</div>
                    <div className="text-xs text-slate-400">Taranan Sayfa Sayısı</div>
                  </div>
                </div>
              </div>
            )}

            {/* Results Table Section */}
            {data && data.length > 0 && (
              <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
                
                {/* Table Toolbar */}
                <div className="p-4 md:p-6 border-b border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3 w-full md:w-auto flex-1">
                    <div className="relative flex-1 max-w-md">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                        <Search className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                        placeholder="Poz no, açıklama, rayiç veya kategori ara..."
                        className="w-full pl-10 pr-4 py-2 bg-slate-950/60 border border-slate-700/80 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                      />
                      {searchTerm && (
                        <button
                          onClick={() => setSearchTerm('')}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <button
                      onClick={() => { setShowOnlySelected(!showOnlySelected); setCurrentPage(1); }}
                      className={`px-3.5 py-2 text-xs font-semibold rounded-xl border transition flex items-center gap-1.5 ${
                        showOnlySelected 
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm' 
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                      }`}
                    >
                      <ShoppingCart className="w-3.5 h-3.5" />
                      {showOnlySelected ? 'Tüm Pozları Göster' : `Sadece Seçilenler (${selectedList.length})`}
                    </button>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <button
                      onClick={selectAllFiltered}
                      className="text-indigo-400 hover:text-indigo-300 font-medium transition"
                    >
                      Filtrelenenleri Seç ({filteredAndSortedData.length})
                    </button>

                    {selectedList.length > 0 && (
                      <button
                        onClick={clearSelection}
                        className="text-red-400 hover:text-red-300 font-medium transition flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        Seçimi Temizle
                      </button>
                    )}

                    <div className="border-l border-slate-800 pl-3">
                      Toplam <span className="font-semibold text-white">{filteredAndSortedData.length}</span> kayıt
                    </div>
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-950/80 text-slate-400 border-b border-slate-800 text-xs font-semibold uppercase tracking-wider">
                        <th className="py-3.5 px-3 w-12 text-center">
                          <button
                            onClick={toggleSelectAllCurrentPage}
                            className="text-slate-400 hover:text-white p-1"
                            title="Bu Sayfadakilerin Tümünü Seç / Kaldır"
                          >
                            {paginatedData.length > 0 && paginatedData.every(r => !!selectedMap[r.id]) ? (
                              <CheckSquare className="w-4 h-4 text-indigo-400" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                        </th>
                        <th className="py-3.5 px-3 w-12 text-center">#</th>
                        <th 
                          onClick={() => handleSort('pozNo')}
                          className="py-3.5 px-4 cursor-pointer hover:text-indigo-400 transition"
                        >
                          <div className="flex items-center gap-1.5">
                            Poz No
                            <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
                          </div>
                        </th>
                        <th 
                          onClick={() => handleSort('tanim')}
                          className="py-3.5 px-4 cursor-pointer hover:text-indigo-400 transition"
                        >
                          <div className="flex items-center gap-1.5">
                            İşin / Malzemenin Tanımı
                            <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
                          </div>
                        </th>
                        <th 
                          onClick={() => handleSort('birim')}
                          className="py-3.5 px-4 w-28 cursor-pointer hover:text-indigo-400 transition text-center"
                        >
                          <div className="flex items-center justify-center gap-1.5">
                            Ölçü Birimi
                            <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
                          </div>
                        </th>
                        {hasSatinAlmaYeri && (
                          <th 
                            onClick={() => handleSort('satinAlmaYeri')}
                            className="py-3.5 px-4 w-32 cursor-pointer hover:text-indigo-400 transition text-center"
                          >
                            <div className="flex items-center justify-center gap-1.5">
                              Satın Alma Yeri
                              <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
                            </div>
                          </th>
                        )}
                        <th 
                          onClick={() => handleSort('fiyat')}
                          className="py-3.5 px-4 w-36 cursor-pointer hover:text-indigo-400 transition text-right"
                        >
                          <div className="flex items-center justify-end gap-1.5">
                            Fiyat (TL)
                            <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
                          </div>
                        </th>
                        <th className="py-3.5 px-4 w-24 text-center">İşlem</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {paginatedData.length === 0 ? (
                        <tr>
                          <td colSpan={hasSatinAlmaYeri ? 8 : 7} className="text-center py-12 text-slate-500">
                            Arama kriterinize uygun birim fiyat veya seçili poz bulunamadı.
                          </td>
                        </tr>
                      ) : (
                        paginatedData.map((row, idx) => {
                          const isSelected = !!selectedMap[row.id];
                          return (
                            <tr
                              key={row.id || idx}
                              onClick={() => toggleSelectPoz(row)}
                              className={`cursor-pointer transition group ${
                                isSelected 
                                  ? 'bg-indigo-950/30 hover:bg-indigo-950/50 border-l-4 border-l-indigo-500' 
                                  : 'hover:bg-slate-800/40'
                              }`}
                            >
                              <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                                <button
                                  onClick={() => toggleSelectPoz(row)}
                                  className="text-slate-400 hover:text-white p-1"
                                >
                                  {isSelected ? (
                                    <CheckSquare className="w-4 h-4 text-indigo-400" />
                                  ) : (
                                    <Square className="w-4 h-4" />
                                  )}
                                </button>
                              </td>
                              <td className="py-3 px-3 text-center text-xs text-slate-500 font-mono">
                                {(currentPage - 1) * pageSize + idx + 1}
                              </td>
                              <td className="py-3 px-4 font-mono font-medium text-indigo-300">
                                {row.pozNo || '-'}
                              </td>
                              <td className="py-3 px-4 text-slate-200 max-w-md">
                                <div className="line-clamp-2">{row.tanim || '-'}</div>
                                {row.kategori && (
                                  <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                                    <Tag className="w-3 h-3 text-slate-600 shrink-0" />
                                    <span className="truncate">{row.kategori}</span>
                                  </div>
                                )}
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span className="inline-block px-2.5 py-0.5 text-xs font-semibold rounded-lg bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                                  {row.birim || 'Adet'}
                                </span>
                              </td>
                              {hasSatinAlmaYeri && (
                                <td className="py-3 px-4 text-center">
                                  {row.satinAlmaYeri ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/20">
                                      <MapPin className="w-3 h-3" />
                                      {row.satinAlmaYeri}
                                    </span>
                                  ) : (
                                    <span className="text-slate-600">-</span>
                                  )}
                                </td>
                              )}
                              <td className="py-3 px-4 text-right font-mono font-semibold text-emerald-400">
                                {row.fiyat ? `${row.fiyat} ₺` : '-'}
                              </td>
                              <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center justify-center gap-1">
                                  <Tooltip.Root>
                                    <Tooltip.Trigger asChild>
                                      <button
                                        onClick={() => {
                                          navigator.clipboard.writeText(`${row.pozNo}\t${row.tanim}\t${row.birim}\t${row.satinAlmaYeri || ''}\t${row.fiyat}`);
                                          triggerToast(`${row.pozNo || 'Kalem'} kopyalandı.`);
                                        }}
                                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition"
                                      >
                                        <Copy className="w-3.5 h-3.5" />
                                      </button>
                                    </Tooltip.Trigger>
                                    <Tooltip.Content className="bg-slate-800 text-white text-xs px-2 py-1 rounded border border-slate-700">
                                      Satırı Kopyala
                                    </Tooltip.Content>
                                  </Tooltip.Root>

                                  <Tooltip.Root>
                                    <Tooltip.Trigger asChild>
                                      <button
                                        onClick={() => { setSelectedItem(row); setIsDialogOpen(true); }}
                                        className="p-1.5 text-slate-400 hover:text-indigo-300 hover:bg-slate-700 rounded-lg transition text-xs font-semibold"
                                      >
                                        Detay
                                      </button>
                                    </Tooltip.Trigger>
                                    <Tooltip.Content className="bg-slate-800 text-white text-xs px-2 py-1 rounded border border-slate-700">
                                      Poz Detayını İncele
                                    </Tooltip.Content>
                                  </Tooltip.Root>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Footer */}
                {totalPages > 1 && (
                  <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                    <div>
                      Sayfa <span className="font-semibold text-white">{currentPage}</span> / {totalPages}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                        disabled={currentPage === 1}
                        className="p-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-slate-800 rounded-lg text-white transition"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className="p-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-slate-800 rounded-lg text-white transition"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

          </main>

          {/* Floating Bottom Bar: Cımbızlanan / Seçili Pozlar Paneli */}
          {selectedList.length > 0 && (
            <aside aria-label="Seçilen Pozlar ve Yaklaşık Maliyet Paneli" className="fixed bottom-4 left-1/2 -translate-x-1/2 w-full max-w-4xl bg-slate-900/95 backdrop-blur-xl border border-indigo-500/40 rounded-2xl p-4 shadow-2xl shadow-indigo-950/80 z-40 animate-slide-up flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl text-white shadow-md">
                  <ShoppingCart className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-base">
                      {selectedList.length} Poz Seçildi (Cımbızlandı)
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono">
                      Sepet
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                    <span>Toplam Keşif Tutarı:</span>
                    <span className="font-bold text-emerald-400 font-mono text-sm">
                      {selectedGrandTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap justify-end">
                <button
                  onClick={() => copyToClipboard(true)}
                  className="px-3.5 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl transition flex items-center gap-1.5 shadow-sm"
                  title="Sadece seçilen pozları doğrudan Excel'e yapıştırılacak şekilde kopyalar"
                >
                  <Copy className="w-3.5 h-3.5 text-indigo-400" />
                  Seçilenleri Excel'e Kopyala
                </button>

                <button
                  onClick={() => exportToCSV(true)}
                  className="px-3.5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition flex items-center gap-1.5 shadow-lg shadow-emerald-600/25"
                  title="Sadece seçilen pozları CSV olarak indirir"
                >
                  <Download className="w-3.5 h-3.5" />
                  Seçilenleri CSV İndir
                </button>

                <button
                  onClick={() => exportToJSON(true)}
                  className="px-3 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl transition flex items-center gap-1.5"
                >
                  <FileCode2 className="w-3.5 h-3.5 text-amber-400" />
                  JSON
                </button>

                <button
                  onClick={clearSelection}
                  className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition"
                  title="Seçimi Temizle"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </aside>
          )}

          {/* Radix Dialog: Toplu Poz No Yapıştır & Bul */}
          <Dialog.Root open={isBatchDialogOpen} onOpenChange={setIsBatchDialogOpen}>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 animate-fade-in" />
              <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-lg shadow-2xl z-50 animate-slide-up">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
                  <Dialog.Title className="text-lg font-bold text-white flex items-center gap-2">
                    <FileSearch className="w-5 h-5 text-indigo-400" />
                    Toplu Poz Numarası Yapıştır & Cımbızla
                  </Dialog.Title>
                  <Dialog.Close className="text-slate-400 hover:text-white p-1 rounded-lg">
                    <X className="w-5 h-5" />
                  </Dialog.Close>
                </div>

                <div className="space-y-4 text-sm">
                  <p className="text-xs text-slate-400">
                    Excel tablonuzdan, hakedişten veya keşif listenizden poz numaralarını kopyalayıp buraya yapıştırın (alt alta veya virgülle ayrılmış):
                  </p>

                  <textarea
                    rows={6}
                    value={batchInput}
                    onChange={(e) => setBatchInput(e.target.value)}
                    placeholder="Örnek:&#10;15.120.1001&#10;10.130.4103&#10;35.800.7180&#10;04.001/01"
                    className="w-full p-3.5 bg-slate-950/80 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-600 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  />

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={() => setIsBatchDialogOpen(false)}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                    >
                      İptal
                    </button>
                    <button
                      onClick={handleBatchPozMatch}
                      disabled={!batchInput.trim()}
                      className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Pozları Bul ve Sepete Ekle
                    </button>
                  </div>
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>

          {/* Radix Dialog: Satır Detay Önizlemesi */}
          <Dialog.Root open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 animate-fade-in" />
              <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-lg shadow-2xl z-50 animate-slide-up">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
                  <Dialog.Title className="text-lg font-bold text-white flex items-center gap-2">
                    <FileText className="w-5 h-5 text-indigo-400" />
                    Poz / Rayiç Kalem Detayı
                  </Dialog.Title>
                  <Dialog.Close className="text-slate-400 hover:text-white p-1 rounded-lg">
                    <X className="w-5 h-5" />
                  </Dialog.Close>
                </div>

                {selectedItem && (
                  <div className="space-y-4 text-sm">
                    {selectedItem.kategori && (
                      <div className="bg-indigo-500/10 border border-indigo-500/20 px-3 py-2 rounded-xl text-xs text-indigo-300 flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 shrink-0" />
                        <span className="font-medium">{selectedItem.kategori}</span>
                      </div>
                    )}

                    <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                      <div className="text-xs text-slate-400 mb-1">Poz / Rayiç Numarası</div>
                      <div className="text-lg font-mono font-bold text-indigo-300">
                        {selectedItem.pozNo || 'Belirtilmemiş'}
                      </div>
                    </div>

                    <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                      <div className="text-xs text-slate-400 mb-1">Tanım / Açıklama</div>
                      <div className="text-slate-200 leading-relaxed max-h-48 overflow-y-auto">
                        {selectedItem.tanim || 'Açıklama yok'}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                        <div className="text-xs text-slate-400 mb-1">Ölçü Birimi</div>
                        <div className="font-semibold text-slate-200">
                          {selectedItem.birim || 'Adet'}
                        </div>
                      </div>

                      <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                        <div className="text-xs text-slate-400 mb-1">Satın Alma Yeri</div>
                        <div className="font-semibold text-amber-300">
                          {selectedItem.satinAlmaYeri || 'İşbaşında / Standart'}
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between">
                      <div>
                        <div className="text-xs text-slate-400">Rayiç / Birim Fiyat</div>
                        <div className="text-xs text-slate-500">Sayfa {selectedItem.sayfa || 1}</div>
                      </div>
                      <div className="text-xl font-mono font-bold text-emerald-400">
                        {selectedItem.fiyat ? `${selectedItem.fiyat} ₺` : 'Fiyat Yok'}
                      </div>
                    </div>

                    <div className="pt-2 flex justify-between items-center gap-2">
                      <button
                        onClick={() => toggleSelectPoz(selectedItem)}
                        className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
                          selectedMap[selectedItem.id]
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            : 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600/30'
                        }`}
                      >
                        <ShoppingCart className="w-3.5 h-3.5" />
                        {selectedMap[selectedItem.id] ? 'Sepetten Çıkar' : 'Sepete Ekle (Cımbızla)'}
                      </button>

                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(`${selectedItem.pozNo}\t${selectedItem.tanim}\t${selectedItem.birim}\t${selectedItem.satinAlmaYeri || ''}\t${selectedItem.fiyat}`);
                          triggerToast('Detay panoya kopyalandı.');
                          setIsDialogOpen(false);
                        }}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl text-xs transition flex items-center gap-1.5"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        Tümünü Kopyala
                      </button>
                    </div>
                  </div>
                )}
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>

          {/* Radix Toast Bildirimleri */}
          <Toast.Root
            open={toastOpen}
            onOpenChange={setToastOpen}
            className="bg-slate-900 border border-slate-700 text-slate-100 px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 data-[state=open]:animate-slide-up z-50"
          >
            <Toast.Title className="text-xs font-medium">{toastMsg}</Toast.Title>
          </Toast.Root>
          <Toast.Viewport className="fixed bottom-4 right-4 flex flex-col gap-2 z-50 max-w-sm w-full outline-none" />

        </div>
      </Toast.Provider>
    </Tooltip.Provider>
  );
}
