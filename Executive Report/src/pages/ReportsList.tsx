import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { FileText, Plus, Search, Loader2, Eye, RefreshCw } from 'lucide-react';
import { CATEGORY_LABELS } from '../types';
import UploadModal from '../components/UploadModal';
import ReportPreviewPanel from '../components/ReportPreviewPanel';

/** Delays updating a value until the user stops changing it for `delayMs` ms */
function useDebounce<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

export default function ReportsList() {
  const { category } = useParams<{ category: string }>();
  const { reports, users, currentUser, agencies, acknowledgments, views, retryReportAnalysis } = useAppStore();

  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 300);

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [previewReportId, setPreviewReportId] = useState<string | null>(null);
  const [retryingIds, setRetryingIds] = useState<Set<string>>(new Set());

  // O(1) lookup map — built once per users change, not per render
  const userMap = useMemo(
    () => Object.fromEntries(users.map(u => [u.id, u])),
    [users]
  );

  // Agency lookup map
  const agencyMap = useMemo(
    () => Object.fromEntries(agencies.map(a => [a.id, a])),
    [agencies]
  );

  const filteredReports = useMemo(() => {
    const searchLower = debouncedSearch.toLowerCase();
    return reports
      .filter(r => {
        const isCategoryMatch = category === 'all' || !category || r.category === category;
        if (!isCategoryMatch) return false;
        if (!searchLower) return true;

        const agencyName = agencyMap[r.agencyId]?.name || '';
        return (
          r.title.toLowerCase().includes(searchLower) ||
          agencyName.toLowerCase().includes(searchLower) ||
          (r.summary || '').toLowerCase().includes(searchLower)
          // NOTE: fullText search intentionally excluded from list view (expensive); use report detail page
        );
      })
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
  }, [reports, category, agencyMap, debouncedSearch]);

  const handleRetry = useCallback(async (reportId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setRetryingIds(prev => new Set(prev).add(reportId));
    const result = await retryReportAnalysis(reportId);
    if (!result.success) alert(result.error || 'ไม่สามารถลองใหม่ได้');
    setRetryingIds(prev => { const s = new Set(prev); s.delete(reportId); return s; });
  }, [retryReportAnalysis]);

  const previewReport = previewReportId ? reports.find(r => r.id === previewReportId) : null;

  const canUpload = ['admin', 'user'].includes(currentUser?.role || '');
  const canSeeStats = ['admin', 'executive'].includes(currentUser?.role || '');

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800 drop-shadow-sm">
            {CATEGORY_LABELS[category || ''] || 'รายงานทั้งหมด'}
          </h1>
          <p className="text-slate-500 mt-1 text-sm font-medium">รายการเอกสารการรายงานและสรุปย่อ</p>
        </div>
        {canUpload && (
          <button
            type="button"
            onClick={() => setShowUploadModal(true)}
            className="inline-flex w-full sm:w-auto items-center justify-center gap-2 px-4 py-2 bg-[#009688] text-white rounded font-bold hover:opacity-90 transition-opacity text-sm shadow-sm"
          >
            <Plus className="w-4 h-4" />
            อัปโหลด PDF ใหม่
          </button>
        )}
      </header>

      {/* Search Bar */}
      <div className="flex items-end gap-4">
        <div className="flex-1 max-w-none sm:max-w-sm flex flex-col">
          <label className="text-xs text-slate-500 font-bold mb-1">ค้นหารายงาน</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="ชื่อรายงาน / หน่วยงาน / สรุปย่อ..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded focus:ring-1 focus:ring-teal-500 outline-none"
            />
          </div>
        </div>
      </div>

      {/* Report List */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        <div className="bg-slate-50 p-3 border-b border-slate-200 flex justify-between">
          <h3 className="font-bold text-sm text-[#00796B]">รายการรายงาน</h3>
          <span className="text-[10px] text-slate-400">พบ {filteredReports.length} รายการ</span>
        </div>

        {filteredReports.length > 0 ? (
          <ul className="divide-y divide-slate-200">
            {filteredReports.map(report => {
              const isAcknowledged = acknowledgments.some(a => a.reportId === report.id && a.userId === currentUser?.id);
              const uploader = userMap[report.uploadedBy]; // O(1) lookup

              return (
                <li key={report.id} className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4 hover:bg-teal-50 transition-colors">
                  <div className="p-2 bg-teal-100 text-[#009688] rounded shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link
                      to={`/report/${report.id}`}
                      className="text-sm font-bold text-slate-800 hover:text-[#009688] truncate block"
                    >
                      {report.title}
                    </Link>
                    <p className="mt-1 text-xs text-slate-600 line-clamp-2">
                      {report.status === 'processing' ? (
                        <span className="text-teal-600 flex items-center gap-1 font-medium">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          {report.summary}
                        </span>
                      ) : report.status === 'failed' ? (
                        <span className="text-red-500 font-medium">{report.summary}</span>
                      ) : (
                        report.summary || 'ไม่มีสรุปย่อ'
                      )}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] font-bold text-slate-500">
                      <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                        หมวดหมู่: {CATEGORY_LABELS[report.category] || report.category}
                      </span>
                      <span>อัปโหลดโดย: {uploader?.displayName || 'Unknown'}</span>
                      <span>{new Date(report.uploadedAt).toLocaleString('th-TH')}</span>
                    </div>
                  </div>
                  <div className="shrink-0 pt-1 sm:pt-0 flex w-full sm:w-auto flex-row flex-wrap sm:flex-col items-center sm:items-end gap-2">
                    {canSeeStats && (
                      <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded">
                        อ่านแล้ว: {views.filter(v => v.reportId === report.id).length} คน |{' '}
                        รับทราบ: {acknowledgments.filter(a => a.reportId === report.id).length} คน
                      </span>
                    )}
                    {currentUser?.role === 'executive' ? (
                      isAcknowledged ? (
                        <span className="inline-flex items-center px-2 py-1 rounded text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200">คุณรับทราบแล้ว</span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">รอการรับทราบจากคุณ</span>
                      )
                    ) : (
                      acknowledgments.some(a => a.reportId === report.id) ? (
                        <span className="inline-flex items-center px-2 py-1 rounded text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200">ผู้บริหารรับทราบแล้ว</span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded text-[10px] font-bold bg-slate-50 text-slate-500 border border-slate-200">ยังไม่มีผู้บริหารรับทราบ</span>
                      )
                    )}
                    <button
                      type="button"
                      onClick={e => { e.preventDefault(); e.stopPropagation(); setPreviewReportId(report.id); }}
                      className="flex items-center justify-center gap-1 px-2 py-1 text-[10px] font-bold text-teal-600 bg-white border border-teal-200 rounded hover:bg-teal-50 transition-colors"
                      title="ดูตัวอย่างแบบด่วน"
                    >
                      <Eye className="w-3 h-3" /> พรีวิว
                    </button>
                    {report.status === 'failed' && (
                      <button
                        type="button"
                        disabled={retryingIds.has(report.id)}
                        onClick={e => handleRetry(report.id, e)}
                        className="flex items-center justify-center gap-1 px-2 py-1 text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 rounded hover:bg-amber-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="ลองวิเคราะห์ AI ใหม่อีกครั้ง"
                      >
                        {retryingIds.has(report.id)
                          ? <><Loader2 className="w-3 h-3 animate-spin" /> กำลังส่ง...</>
                          : <><RefreshCw className="w-3 h-3" /> ลองใหม่</>}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="p-12 flex flex-col items-center justify-center text-slate-400">
            <FileText className="w-10 h-10 text-slate-300 mb-3" />
            <p className="text-sm font-bold text-slate-600">ไม่พบรายงาน</p>
            <p className="text-xs mt-1">ยังไม่มีรายงานในหมวดหมู่นี้</p>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <UploadModal
          category={category}
          onClose={() => setShowUploadModal(false)}
          onSuccess={() => setShowUploadModal(false)}
        />
      )}

      {/* Preview Panel */}
      {previewReport && (
        <ReportPreviewPanel
          report={previewReport}
          onClose={() => setPreviewReportId(null)}
        />
      )}
    </div>
  );
}
