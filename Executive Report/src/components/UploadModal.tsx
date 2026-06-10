import React, { useState } from 'react';
import { FileText, UploadCloud, X, Loader2 } from 'lucide-react';
import { ReportCategory, CATEGORY_LABELS, VALID_CATEGORIES } from '../types';
import { useAppStore } from '../store/useAppStore';
import ConfirmModal from './ConfirmModal';

interface UploadModalProps {
  category: string | undefined;
  onClose: () => void;
  onSuccess: () => void;
}

export default function UploadModal({ category, onClose, onSuccess }: UploadModalProps) {
  const { currentUser, agencies, addReport, fetchReports, token } = useAppStore();

  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [confirmUpload, setConfirmUpload] = useState(false);

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (!droppedFile) return;
    if (droppedFile.type !== 'application/pdf') {
      alert('กรุณาอัปโหลดไฟล์ PDF เท่านั้น');
      return;
    }
    setFile(droppedFile);
    if (!title) setTitle(droppedFile.name.replace(/\.pdf$/i, ''));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] || null;
    setFile(selected);
    if (selected && !title) setTitle(selected.name.replace(/\.pdf$/i, ''));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !title) return;
    setConfirmUpload(true);
  };

  /** Upload the file, trigger AI analysis, then save the report record. */
  const executeUpload = async () => {
    setConfirmUpload(false);
    setIsUploading(true);
    try {
      // 1. Upload file to server
      const formData = new FormData();
      formData.append('report', file!);
      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (uploadRes.status === 401) { useAppStore.getState().logout(); return; }
      if (!uploadRes.ok) throw new Error('ไม่สามารถอัปโหลดไฟล์ได้');

      const { fileUrl } = await uploadRes.json();
      if (!fileUrl) throw new Error('ไม่ได้รับที่อยู่ไฟล์หลังอัปโหลด');

      // 2. Trigger background AI analysis
      const autoCategory: ReportCategory = VALID_CATEGORIES.includes(category as ReportCategory)
        ? (category as ReportCategory)
        : 'agency';

      let summary = 'กำลังเริ่มการจัดทำสรุปด้วย AI...';
      let jobId: string | undefined;
      let status: 'processing' | 'failed' = 'processing';

      try {
        const analyzeRes = await fetch('/api/analyze-pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ fileUrl, category: autoCategory }),
        });
        if (analyzeRes.status === 401) { useAppStore.getState().logout(); return; }
        if (analyzeRes.ok) {
          const analyzeData = await analyzeRes.json();
          jobId = analyzeData.jobId;
        } else {
          const err = await analyzeRes.json().catch(() => ({}));
          summary = `ไม่สามารถวิเคราะห์ AI ได้: ${err.error || 'Unknown error'}`;
          status = 'failed';
        }
      } catch {
        summary = 'ข้อผิดพลาดในการเชื่อมต่อ (Network error)';
        status = 'failed';
      }

      // 3. Save report record to DB
      const newReport = {
        id: self.crypto.randomUUID(),
        title,
        category: autoCategory,
        agencyId: currentUser?.agencyId || agencies[0]?.id,
        fileUrl,
        summary,
        fullText: '',
        uploadedBy: currentUser!.id,
        uploadedAt: new Date().toISOString(),
        status,
        jobId,
      };
      await addReport(newReport as any);

      // 4. Lightweight refresh — only fetch reports list, not all 7 tables
      await fetchReports();

      onSuccess();
    } catch (error: any) {
      console.error(error);
      alert(error.message || 'เกิดข้อผิดพลาดในการอัปโหลดไฟล์เข้าระบบ');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-4">
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-xl w-full max-w-lg max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)] overflow-y-auto">
          <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-100">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900">อัปโหลดรายงานใหม่</h2>
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-5">
            {/* Title */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">ชื่อรายงาน</label>
              <input
                type="text"
                required
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="เช่น รายงานผลการดำเนินงานประจำไตรมาส..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            {/* Category (read-only) */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">หมวดหมู่</label>
              <select disabled className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500">
                <option>{CATEGORY_LABELS[category || 'agency'] || 'รายงานระดับหน่วยงาน'}</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">หมวดหมู่จะถูกกำหนดตามหน้าที่คุณกำลังใช้งานอยู่</p>
            </div>

            {/* File drop zone */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">ไฟล์รายงาน (PDF)</label>
              <div
                className={`mt-1 flex justify-center px-3 sm:px-6 pt-4 sm:pt-5 pb-4 sm:pb-6 border-2 border-dashed rounded-lg transition-colors cursor-pointer
                  ${isDragging ? 'border-teal-500 bg-teal-50' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => document.getElementById('file-upload-input')?.click()}
              >
                <div className="space-y-1 text-center">
                  <UploadCloud className={`mx-auto h-12 w-12 ${isDragging ? 'text-teal-500' : 'text-gray-400'}`} />
                  <span className="text-sm font-medium text-teal-600">
                    คลิกเพื่อเลือกไฟล์ หรือลากไฟล์มาวางที่นี่
                  </span>
                  <input
                    id="file-upload-input"
                    type="file"
                    className="sr-only"
                    accept="application/pdf"
                    onChange={handleFileChange}
                  />
                  <p className="text-xs text-gray-500">PDF เท่านั้น (สูงสุด 50MB)</p>
                </div>
              </div>
              {file && (
                <p className="mt-2 text-sm text-teal-600 font-medium flex items-start gap-2 break-all">
                  <FileText className="w-4 h-4 shrink-0 mt-0.5" /> ไฟล์ที่เลือก: {file.name}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="pt-4 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={!file || !title || isUploading}
                className="inline-flex w-full sm:w-auto items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#009688] rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed sm:min-w-[130px] transition-colors"
              >
                {isUploading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> กำลังวิเคราะห์ AI...</>
                ) : (
                  'อัปโหลดและวิเคราะห์'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {confirmUpload && (
        <ConfirmModal
          isOpen={confirmUpload}
          title="ยืนยันการอัปโหลดรายงาน"
          message={`คุณต้องการอัปโหลดรายงาน "${title}" เข้าสู่ระบบและเริ่มต้นวิเคราะห์ด้วย AI ใช่หรือไม่?`}
          confirmText="อัปโหลดและวิเคราะห์"
          cancelText="ยกเลิก"
          type="info"
          onConfirm={executeUpload}
          onCancel={() => setConfirmUpload(false)}
        />
      )}
    </>
  );
}
