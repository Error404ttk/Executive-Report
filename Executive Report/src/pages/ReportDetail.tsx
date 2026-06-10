import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { ArrowLeft, CheckCircle, FileText, Send, User as UserIcon, Maximize, Minimize, Edit, Trash2, X, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { ReportCategory } from '../types';
import ConfirmModal from '../components/ConfirmModal';

export default function ReportDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { reports, currentUser, users, acknowledgments, comments, acknowledgeReport, addComment, markAsRead, updateReport, deleteReport, fetchReportDetail } = useAppStore();
  
  const [commentText, setCommentText] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(searchParams.get('fullscreen') === 'true');
  
  // Edit state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editSummary, setEditSummary] = useState('');
  const [editCategory, setEditCategory] = useState<ReportCategory>('agency');

  // Delete state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [showFinalDeleteConfirm, setShowFinalDeleteConfirm] = useState(false);

  // Acknowledge state
  const [showAcknowledgeConfirm, setShowAcknowledgeConfirm] = useState(false);

  const report = reports.find(r => r.id === id);

  useEffect(() => {
    if (id) {
      fetchReportDetail(id);
    }
  }, [id, fetchReportDetail]);

  useEffect(() => {
    if (report && currentUser) {
      markAsRead(report.id, currentUser.id);
      setEditTitle(report.title);
      setEditSummary(report.summary || '');
      setEditCategory(report.category);
    }
  }, [report, currentUser, markAsRead]);

  
  if (!report) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-bold text-gray-900">ไม่พบรายงาน</h2>
        <button onClick={() => navigate(-1)} className="mt-4 text-health-green hover:underline">กลับ</button>
      </div>
    );
  }

  const uploader = users.find(u => u.id === report.uploadedBy);
  const isAcknowledged = acknowledgments.some(a => a.reportId === report.id && a.userId === currentUser?.id);
  const reportComments = comments.filter(c => c.reportId === report.id).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const handleAcknowledge = () => {
    if (currentUser?.role === 'executive' && !isAcknowledged) {
      setShowAcknowledgeConfirm(true);
    }
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !report) return;
    
    if (window.confirm('คุณแน่ใจหรือไม่ว่าต้องการบันทึกการแก้ไขข้อมูลรายงานนี้?')) {
      updateReport({
        ...report,
        title: editTitle,
        summary: editSummary,
        category: editCategory
      }, currentUser.id);
      
      setShowEditModal(false);
    }
  };

  const handleDeleteTrigger = () => {
    setShowDeleteModal(true);
    setAdminPassword('');
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !report) return;
    setShowFinalDeleteConfirm(true);
  };

  const executeDelete = async () => {
    setShowFinalDeleteConfirm(false);
    if (!currentUser || !report) return;
    
    const res = await deleteReport(report.id, currentUser.id, adminPassword);
    if (res.success) {
      setShowDeleteModal(false);
      navigate(`/reports/${report.category}`);
    } else {
      alert(res.error || 'รหัสผ่านผู้ดูแลระบบไม่ถูกต้อง!');
    }
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !currentUser) return;
    
    if (window.confirm('ยืนยันการส่งความคิดเห็นนี้หรือไม่?')) {
      addComment({
        id: self.crypto.randomUUID(),
        reportId: report.id,
        userId: currentUser.id,
        content: commentText.trim(),
        createdAt: new Date().toISOString()
      });
      
      setCommentText('');
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 pb-12 sm:pb-20">
      {/* Header operations */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900">
          <ArrowLeft className="w-4 h-4" />
          ย้อนกลับ
        </button>
        
        {currentUser?.role === 'admin' && (
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowEditModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 transition-colors"
            >
              <Edit className="w-3.5 h-3.5" /> แก้ไข
            </button>
            <button 
              onClick={handleDeleteTrigger}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-rose-500 rounded hover:bg-rose-600 shadow-sm transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" /> ลบ
            </button>
          </div>
        )}
      </div>

      {/* Main Card */}
      <div className="flex flex-col space-y-4">
        <div className="bg-white p-3 sm:p-5 rounded-lg shadow-sm border border-slate-200 flex-1 relative overflow-hidden">
          <div className="flex items-start justify-between gap-4 flex-col sm:flex-row mb-6">
            <div>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-3 text-xs font-bold text-[#009688]">
                <span className="uppercase">{report.category}</span>
                <span>•</span>
                <span>{new Date(report.uploadedAt).toLocaleString('th-TH')}</span>
              </div>
              <h1 className="text-xl md:text-2xl font-bold text-slate-800 leading-tight">
                {report.title}
              </h1>
              <div className="mt-2 flex items-start gap-2 text-xs text-slate-600 break-words">
                <div className="p-1.5"><UserIcon className="w-4 h-4" /></div>
                <span>อัปโหลดโดย: <strong>{uploader?.displayName}</strong> ({uploader?.email})</span>
              </div>
            </div>
            <div className="shrink-0 w-full sm:w-auto mt-4 sm:mt-0">
              {currentUser?.role === 'executive' ? (
                isAcknowledged ? (
                  <div className="inline-flex items-center justify-center w-full sm:w-auto gap-2 px-6 py-2 rounded text-xs font-bold border border-teal-600 text-teal-600">
                    <CheckCircle className="w-4 h-4" />
                    รับทราบแล้ว
                  </div>
                ) : (
                  <button
                    onClick={handleAcknowledge}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2 rounded text-xs font-bold bg-[#009688] text-white shadow-lg shadow-teal-200 hover:opacity-90 transition-opacity"
                  >
                    <CheckCircle className="w-4 h-4" />
                    กดปุ่มเพื่อรับทราบ
                  </button>
                )
              ) : (
                /* For non-executive roles, show list of executives who acknowledged */
                <div className="text-xs text-slate-500 font-bold bg-slate-50 border border-slate-200 p-2.5 rounded flex flex-col gap-1">
                  <div>ผู้รับทราบรายงาน:</div>
                  <div className="text-[#009688]">
                    {(() => {
                      const execAcks = acknowledgments
                        .filter(a => a.reportId === report.id)
                        .map(a => users.find(u => u.id === a.userId)?.displayName)
                        .filter(Boolean);
                      return execAcks.length > 0 ? execAcks.join(', ') : 'ยังไม่มีผู้รับทราบ';
                    })()}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Left Column: AI Summary & Comments */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-6 min-w-0">
            <div className="bg-white p-3 sm:p-5 rounded-lg shadow-sm border border-slate-200 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-2">
                <span className="px-2 py-1 bg-teal-600 text-white text-[10px] rounded">AI ANALYSIS</span>
              </div>
              <h3 className="font-bold text-base mb-3 text-slate-800">สรุปใจความสำคัญ (Summary)</h3>
              <div className="space-y-4 text-sm text-slate-600 prose prose-sm md:prose-base max-w-none">
                {report.status === 'processing' ? (
                  <div className="flex flex-col items-center justify-center p-8 text-teal-600 space-y-4">
                    <Loader2 className="w-8 h-8 animate-spin" />
                    <p className="font-medium animate-pulse">{report.summary}</p>
                  </div>
                ) : report.status === 'failed' ? (
                  <p className="text-red-500 font-medium p-4 bg-red-50 rounded border border-red-200">{report.summary}</p>
                ) : report.summary ? (
                  <ReactMarkdown>{report.summary}</ReactMarkdown>
                ) : (
                  <p className="italic text-slate-500">ไม่มีผลการวิเคราะห์</p>
                )}
              </div>
            </div>

            <div className="bg-slate-800 p-4 rounded-lg flex flex-col">
              <h4 className="text-white text-xs font-bold mb-4 flex items-center space-x-1">
                <span>ความเห็นจากผู้บริหาร ({reportComments.length})</span>
              </h4>
              
              <div className="space-y-4 mb-4 max-h-[300px] overflow-y-auto pr-2">
                {reportComments.length > 0 ? reportComments.map(comment => {
                  const cUser = users.find(u => u.id === comment.userId);
                  const isMe = cUser?.id === currentUser?.id;
                  
                  return (
                    <div key={comment.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
                      <div className="w-8 h-8 rounded bg-slate-600 text-white flex items-center justify-center shrink-0 font-bold text-xs">
                        {cUser?.displayName.charAt(0) || 'U'}
                      </div>
                      <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[80%]`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold text-slate-300">{isMe ? 'คุณ' : cUser?.displayName}</span>
                          <span className="text-[10px] text-slate-500">{new Date(comment.createdAt).toLocaleString('th-TH')}</span>
                        </div>
                        <div className={`px-3 py-2 rounded text-xs ${isMe ? 'bg-teal-600 text-white' : 'bg-slate-700 text-white'}`}>
                          {comment.content}
                        </div>
                      </div>
                    </div>
                  );
                }) : (
                  <div className="text-center py-4 text-slate-500 text-xs">
                    ยังไม่มีความคิดเห็น
                  </div>
                )}
              </div>

              <form onSubmit={handleAddComment} className="flex flex-col gap-2 border-t border-slate-700 pt-3">
                <textarea
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  placeholder="ระบุความคิดเห็นที่นี่..."
                  className="bg-slate-700 text-white border-none rounded p-2 text-xs h-20 outline-none focus:ring-1 focus:ring-teal-400 placeholder-slate-500 resize-none"
                />
                <button
                  type="submit"
                  disabled={!commentText.trim()}
                  className="self-end bg-teal-500 text-white py-1 px-4 rounded text-xs font-bold disabled:opacity-50"
                >
                  ส่งความเห็นกลับ
                </button>
              </form>
            </div>
          </div>

          {/* Right Column: PDF Viewer Context */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg p-4 border border-slate-200">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4 text-slate-500" />
                  ไฟล์รายงานต้นฉบับ
                </h3>
                <button 
                  onClick={() => setIsFullscreen(true)}
                  className="p-1 text-slate-400 hover:text-[#009688] hover:bg-teal-50 rounded transition-colors"
                  title="ขยายเต็มจอ"
                >
                  <Maximize className="w-4 h-4" />
                </button>
              </div>
              <div className="aspect-[3/4] bg-slate-50 border border-slate-200 rounded flex items-center justify-center mb-4 overflow-hidden relative">
                <iframe src={report.fileUrl} className="w-full h-full border-0" title="PDF Viewer" />
              </div>
              <a 
                href={report.fileUrl} 
                target="_blank" 
                rel="noreferrer"
                className="w-full flex justify-center py-2 border border-teal-600 text-teal-600 rounded text-xs font-bold hover:bg-teal-50 transition-colors"
              >
                ดาวน์โหลด (PDF)
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Fullscreen PDF Modal */}
      {isFullscreen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-900/95 backdrop-blur-sm">
          <div className="flex justify-between items-center gap-2 p-2 sm:p-4 bg-slate-900 border-b border-slate-800 shadow-sm">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="p-2 bg-slate-800 rounded">
                <FileText className="w-5 h-5 text-teal-500" />
              </div>
              <h3 className="font-bold text-white text-xs sm:text-sm md:text-base truncate">
                {report.title}
              </h3>
            </div>
            <div className="flex items-center gap-1 sm:gap-3 shrink-0">
              <a 
                href={report.fileUrl} 
                target="_blank" 
                rel="noreferrer"
                className="hidden sm:inline-flex text-slate-300 hover:text-white text-xs font-bold px-3 py-2"
              >
                เปิดในแท็บใหม่
              </a>
              <button 
                onClick={() => setIsFullscreen(false)}
                className="flex items-center gap-2 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 sm:px-4 py-2 rounded transition-colors border border-slate-700"
              >
                <Minimize className="w-4 h-4" />
                <span className="hidden sm:inline">ย่อหน้าจอ</span>
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-hidden w-full h-full flex justify-center">
            <iframe src={report.fileUrl} className="w-full h-full max-w-5xl bg-white" title="PDF Viewer Fullscreen" />
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Edit className="w-5 h-5 text-[#009688]" />
                แก้ไขรายละเอียดรายงาน
              </h2>
              <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-600 focus:outline-none">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleEditSubmit} className="p-4 sm:p-5 space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">ชื่อรายงาน</label>
                <input 
                  type="text" 
                  required
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-500" 
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">หมวดหมู่</label>
                <select 
                  value={editCategory}
                  onChange={e => setEditCategory(e.target.value as ReportCategory)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="agency">รายงานระดับหน่วยงาน</option>
                  <option value="department">รายงานฝ่าย</option>
                  <option value="meeting">รายงานการประชุม</option>
                  <option value="audit">รายงานตรวจสอบภายใน</option>
                  <option value="cyber">รายงาน Cyber</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">บทสรุป (Summary)</label>
                <textarea 
                  value={editSummary}
                  onChange={e => setEditSummary(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded h-32 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none" 
                  style={{ fontFamily: 'var(--font-sans)' }}
                />
              </div>

              <div className="pt-4 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 border-t border-slate-100">
                <button type="button" onClick={() => setShowEditModal(false)} className="w-full sm:w-auto px-4 py-2 text-sm font-bold text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50">
                  ยกเลิก
                </button>
                <button 
                  type="submit" 
                  className="w-full sm:w-auto px-4 py-2 text-sm font-bold text-white rounded hover:opacity-90 sm:min-w-[100px]"
                  style={{ backgroundColor: '#009688' }}
                >
                  บันทึก
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-rose-50">
              <h2 className="text-lg font-bold text-rose-700 flex items-center gap-2">
                <Trash2 className="w-5 h-5" />
                ยืนยันการลบรายงาน
              </h2>
              <button onClick={() => setShowDeleteModal(false)} className="text-gray-400 hover:text-gray-600 focus:outline-none">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handlePasswordSubmit} className="p-4 sm:p-5 space-y-4">
              <div className="bg-rose-50 text-rose-800 p-3 rounded text-sm font-medium mb-4">
                คุณกำลังจะลบรายงาน "{report.title}"  
                การกระทำนี้ไม่สามารถย้อนกลับได้ โปรดใส่รหัสผ่านผู้ดูแลระบบเพื่อยืนยัน
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">รหัสผ่านผู้ดูแลระบบ (Admin Password)</label>
                <input 
                  type="password" 
                  required
                  value={adminPassword}
                  onChange={e => setAdminPassword(e.target.value)}
                  placeholder="ใส่รหัสผ่านเพื่อยืนยัน"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-rose-500" 
                />
              </div>

              <div className="pt-4 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 border-t border-slate-100">
                <button type="button" onClick={() => setShowDeleteModal(false)} className="w-full sm:w-auto px-4 py-2 text-sm font-bold text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50">
                  ยกเลิก
                </button>
                <button 
                  type="submit" 
                  className="w-full sm:w-auto px-4 py-2 text-sm font-bold text-white bg-rose-600 rounded hover:bg-rose-700 sm:min-w-[100px]"
                >
                  ยืนยันการลบ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showFinalDeleteConfirm && (
        <ConfirmModal
          isOpen={showFinalDeleteConfirm}
          title="ยืนยันการลบรายงานอย่างถาวร"
          message={`ยืนยันการลบรายงาน "${report.title}" อย่างถาวร? การกระทำนี้ไม่สามารถย้อนกลับได้`}
          confirmText="ยืนยันการลบ"
          cancelText="ยกเลิก"
          type="danger"
          onConfirm={executeDelete}
          onCancel={() => setShowFinalDeleteConfirm(false)}
        />
      )}

      {showAcknowledgeConfirm && (
        <ConfirmModal
          isOpen={showAcknowledgeConfirm}
          title="ยืนยันการรับทราบรายงาน"
          message={`คุณต้องการบันทึกการรับทราบรายงาน "${report.title}" ใช่หรือไม่?`}
          confirmText="รับทราบ"
          cancelText="ยกเลิก"
          type="info"
          onConfirm={() => {
            setShowAcknowledgeConfirm(false);
            acknowledgeReport(report.id, currentUser!.id);
          }}
          onCancel={() => setShowAcknowledgeConfirm(false)}
        />
      )}
    </div>
  );
}
