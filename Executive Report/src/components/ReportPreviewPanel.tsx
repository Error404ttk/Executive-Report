import React from 'react';
import { Link } from 'react-router-dom';
import { Eye, X, FileText } from 'lucide-react';
import { Report } from '../types';
import { CATEGORY_LABELS } from '../types';

interface ReportPreviewPanelProps {
  report: Report;
  onClose: () => void;
}

export default function ReportPreviewPanel({ report, onClose }: ReportPreviewPanelProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right-8 duration-300"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <div className="flex items-center gap-2 text-[#009688]">
            <Eye className="w-5 h-5" />
            <h3 className="font-bold text-slate-800">พรีวิวด่วน</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          <h4 className="text-lg font-bold text-slate-900 mb-2 leading-tight">{report.title}</h4>

          <div className="flex flex-wrap items-center gap-2 mb-6 text-xs text-slate-500 font-bold">
            <span className="bg-teal-50 text-teal-700 px-2 py-1 rounded">
              {CATEGORY_LABELS[report.category] || report.category}
            </span>
            <span>{new Date(report.uploadedAt).toLocaleString('th-TH')}</span>
          </div>

          {/* AI Summary */}
          <div className="mb-6">
            <h5 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b border-teal-100 pb-2 mb-3">
              <FileText className="w-4 h-4 text-teal-500" />
              สรุปย่อ (AI Generated)
            </h5>
            <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap bg-slate-50 p-3 rounded-lg border border-slate-100">
              {report.summary || 'ไม่มีข้อมูลสรุปสำหรับรายงานนี้'}
            </div>
          </div>

          {/* PDF Preview */}
          <div>
            <h5 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b border-teal-100 pb-2 mb-3">
              <FileText className="w-4 h-4 text-teal-500" />
              ตัวอย่างเอกสาร
            </h5>
            <div className="aspect-[3/4] bg-slate-50 border border-slate-200 rounded relative overflow-hidden">
              <iframe
                src={`${report.fileUrl}#view=FitH&toolbar=0&navpanes=0`}
                className="w-full h-full border-0 pointer-events-none"
                title="PDF Preview"
                tabIndex={-1}
              />
              {/* Transparent overlay to prevent iframe from capturing clicks */}
              <div className="absolute inset-0 bg-transparent" />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50">
          <Link
            to={`/report/${report.id}?fullscreen=true`}
            className="block w-full bg-[#009688] hover:bg-teal-700 text-white font-bold py-2.5 px-4 rounded text-center text-sm transition-colors shadow-sm"
          >
            อ่านรายงานฉบับเต็ม
          </Link>
        </div>
      </div>
    </div>
  );
}
