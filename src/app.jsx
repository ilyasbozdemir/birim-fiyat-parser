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
  Check
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
  const [sortField, setSortField] = useState('pozNo');
  const [sortDirection, setSortDirection] = useState('asc'); // 'asc' | 'desc'
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  // Selected Item for Dialog Preview
  const [selectedItem, setSelectedItem] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

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
      // Electron'da file.path tam dosya yolunu verir
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
      setCurrentPage(1);
      triggerToast(`✅ ${result.data?.length || 0} satır başarıyla ayrıştırıldı!`);
    }
  };

  // Tablo Filtreleme ve Sıralama
  const filteredAndSortedData = useMemo(() => {
    if (!data) return [];
    
    let list = data.filter(item => {
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        (item.pozNo && item.pozNo.toLowerCase().includes(term)) ||
        (item.tanim && item.tanim.toLowerCase().includes(term)) ||
        (item.birim && item.birim.toLowerCase().includes(term)) ||
        (item.fiyat && item.fiyat.toLowerCase().includes(term))
      );
    });

    list.sort((a, b) => {
      let valA = a[sortField] || '';
      let valB = b[sortField] || '';

      if (sortField === 'fiyat') {
        const numA = parseFloat(String(valA).replace(/\./g, '').replace(',', '.')) || 0;
        const numB = parseFloat(String(valB).replace(/\./g, '').replace(',', '.')) || 0;
        return sortDirection === 'asc' ? numA - numB : numB - numA;
      }

      const cmp = String(valA).localeCompare(String(valB), 'tr');
      return sortDirection === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [data, searchTerm, sortField, sortDirection]);

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

  // Dışa Aktarma: CSV
  const exportToCSV = () => {
    if (!data || data.length === 0) return;
    
    const csvContent = [
      ['Poz No', 'Tanım', 'Birim', 'Fiyat (TL)'],
      ...data.map(row => [row.pozNo || '', row.tanim || '', row.birim || '', row.fiyat || ''])
    ]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `birim_fiyatlar_${Date.now()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    triggerToast('📥 CSV dosyası indirildi.');
  };

  // Dışa Aktarma: JSON
  const exportToJSON = () => {
    if (!data || data.length === 0) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `birim_fiyatlar_${Date.now()}.json`;
    a.click();
    window.URL.revokeObjectURL(url);
    triggerToast('📥 JSON dosyası indirildi.');
  };

  // Panoya Kopyala (Excel Uygun TSV)
  const copyToClipboard = () => {
    if (!data || data.length === 0) return;
    const tsv = [
      ['Poz No', 'Tanım', 'Birim', 'Fiyat (TL)'].join('\t'),
      ...data.map(row => [row.pozNo || '', row.tanim || '', row.birim || '', row.fiyat || ''].join('\t'))
    ].join('\n');

    navigator.clipboard.writeText(tsv);
    triggerToast('📋 Tablo Excel uyumlu olarak panoya kopyalandı!');
  };

  return (
    <Tooltip.Provider>
      <Toast.Provider swipeDirection="right">
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center p-4 md:p-8">
          
          {/* Header */}
          <header className="w-full max-w-6xl mb-8 flex flex-col md:flex-row items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-lg shadow-indigo-500/20 ring-1 ring-white/20">
                <FileSpreadsheet className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-indigo-200 to-purple-400">
                  Birim Fiyat Parser <span className="text-xs uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">Pro</span>
                </h1>
                <p className="text-sm text-slate-400">
                  PDF & Web URL birim fiyat tablolarını saniyeler içinde parse edin ve dışa aktarın
                </p>
              </div>
            </div>

            {data && data.length > 0 && (
              <div className="flex items-center gap-2">
                <Tooltip.Root>
                  <Tooltip.Trigger asChild>
                    <button
                      onClick={copyToClipboard}
                      className="px-3 py-2 text-sm font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl transition flex items-center gap-2 shadow-sm"
                    >
                      <Copy className="w-4 h-4 text-indigo-400" />
                      Panoya Kopyala
                    </button>
                  </Tooltip.Trigger>
                  <Tooltip.Content className="bg-slate-800 text-white text-xs px-2.5 py-1.5 rounded-md border border-slate-700 shadow-xl">
                    Excel'e doğrudan yapıştırmak için TSV formatında kopyalar
                  </Tooltip.Content>
                </Tooltip.Root>

                <button
                  onClick={exportToCSV}
                  className="px-4 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition flex items-center gap-2 shadow-lg shadow-emerald-600/20"
                >
                  <Download className="w-4 h-4" />
                  CSV İndir
                </button>

                <button
                  onClick={exportToJSON}
                  className="px-3 py-2 text-sm font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl transition flex items-center gap-2"
                >
                  <FileCode2 className="w-4 h-4 text-amber-400" />
                  JSON
                </button>
              </div>
            )}
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
                      Bakanlık, kamu ihale veya özel birim fiyat cetveli PDF belgelerini anında tarayın
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
                          placeholder="https://ornek.gov.tr/fiyat-listesi-2024.pdf"
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
                      Ayrıştırma Tamamlandı
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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 flex items-center gap-4">
                  <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl">
                    <TableIcon className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-white">{data.length}</div>
                    <div className="text-xs text-slate-400">Toplam Poz Kalemi</div>
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
                  <div className="p-3 bg-purple-500/10 text-purple-400 rounded-xl">
                    <Layers className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-white">{meta?.tableCount || 1}</div>
                    <div className="text-xs text-slate-400">Taranan Tablo Sayısı</div>
                  </div>
                </div>
              </div>
            )}

            {/* Results Table Section */}
            {data && data.length > 0 && (
              <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
                
                {/* Table Toolbar */}
                <div className="p-4 md:p-6 border-b border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="relative w-full md:w-80">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                      <Search className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                      placeholder="Poz no veya açıklamada ara..."
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

                  <div className="text-xs text-slate-400">
                    Toplam <span className="font-semibold text-white">{filteredAndSortedData.length}</span> kayıt listeleniyor
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-950/80 text-slate-400 border-b border-slate-800 text-xs font-semibold uppercase tracking-wider">
                        <th className="py-3.5 px-4 w-16 text-center">#</th>
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
                            Birim
                            <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
                          </div>
                        </th>
                        <th 
                          onClick={() => handleSort('fiyat')}
                          className="py-3.5 px-4 w-36 cursor-pointer hover:text-indigo-400 transition text-right"
                        >
                          <div className="flex items-center justify-end gap-1.5">
                            Birim Fiyat (TL)
                            <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
                          </div>
                        </th>
                        <th className="py-3.5 px-4 w-20 text-center">İşlem</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {paginatedData.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center py-12 text-slate-500">
                            Arama kriterinize uygun birim fiyat bulunamadı.
                          </td>
                        </tr>
                      ) : (
                        paginatedData.map((row, idx) => (
                          <tr
                            key={row.id || idx}
                            onClick={() => { setSelectedItem(row); setIsDialogOpen(true); }}
                            className="hover:bg-slate-800/40 cursor-pointer transition group"
                          >
                            <td className="py-3 px-4 text-center text-xs text-slate-500 font-mono">
                              {(currentPage - 1) * pageSize + idx + 1}
                            </td>
                            <td className="py-3 px-4 font-mono font-medium text-indigo-300">
                              {row.pozNo || '-'}
                            </td>
                            <td className="py-3 px-4 text-slate-200 line-clamp-2 max-w-md">
                              {row.tanim || '-'}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className="inline-block px-2.5 py-0.5 text-xs font-semibold rounded-lg bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                                {row.birim || 'Adet'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-semibold text-emerald-400">
                              {row.fiyat ? `${row.fiyat} ₺` : '-'}
                            </td>
                            <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                              <Tooltip.Root>
                                <Tooltip.Trigger asChild>
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(`${row.pozNo}\t${row.tanim}\t${row.birim}\t${row.fiyat}`);
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
                            </td>
                          </tr>
                        ))
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

          {/* Radix Dialog: Satır Detay Önizlemesi */}
          <Dialog.Root open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 animate-fade-in" />
              <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-lg shadow-2xl z-50 animate-slide-up">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
                  <Dialog.Title className="text-lg font-bold text-white flex items-center gap-2">
                    <FileText className="w-5 h-5 text-indigo-400" />
                    Poz Kalem Detayı
                  </Dialog.Title>
                  <Dialog.Close className="text-slate-400 hover:text-white p-1 rounded-lg">
                    <X className="w-5 h-5" />
                  </Dialog.Close>
                </div>

                {selectedItem && (
                  <div className="space-y-4 text-sm">
                    <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                      <div className="text-xs text-slate-400 mb-1">Poz Numarası</div>
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
                        <div className="text-xs text-slate-400 mb-1">Birim</div>
                        <div className="font-semibold text-slate-200">
                          {selectedItem.birim || 'Adet'}
                        </div>
                      </div>

                      <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                        <div className="text-xs text-slate-400 mb-1">Birim Fiyat</div>
                        <div className="text-lg font-mono font-bold text-emerald-400">
                          {selectedItem.fiyat ? `${selectedItem.fiyat} ₺` : 'Fiyat Yok'}
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 flex justify-end gap-2">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(`${selectedItem.pozNo}\t${selectedItem.tanim}\t${selectedItem.birim}\t${selectedItem.fiyat}`);
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
            className="bg-slate-900 border border-slate-700 text-slate-100 px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 data-[state=open]:animate-slide-up"
          >
            <Toast.Title className="text-xs font-medium">{toastMsg}</Toast.Title>
          </Toast.Root>
          <Toast.Viewport className="fixed bottom-4 right-4 flex flex-col gap-2 z-50 max-w-sm w-full outline-none" />

        </div>
      </Toast.Provider>
    </Tooltip.Provider>
  );
}
