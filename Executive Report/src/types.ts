export type Role = 'admin' | 'executive' | 'user';

export type ReportCategory = 
  | 'agency' // รายงานระดับหน่วยงาน
  | 'department' // รายงานฝ่าย
  | 'meeting' // รายงานการประชุม
  | 'audit' // รายงานตรวจสอบภายใน
  | 'cyber'; // รายงาน Cyber

export const VALID_CATEGORIES: ReportCategory[] = ['agency', 'department', 'meeting', 'audit', 'cyber'];

export const CATEGORY_LABELS: Record<string, string> = {
  agency: 'รายงานระดับหน่วยงาน',
  department: 'รายงานฝ่าย',
  meeting: 'รายงานการประชุม',
  audit: 'รายงานตรวจสอบภายใน',
  cyber: 'รายงาน Cyber',
};


export interface User {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  agencyId?: string;
  avatarUrl?: string;
}

export interface Agency {
  id: string;
  name: string;
  description: string;
  createdAt: string;
}

export interface Report {
  id: string;
  title: string;
  category: ReportCategory;
  agencyId: string;
  fileUrl: string; // The URL to view/download the original PDF
  summary: string; // AI generated summary
  fullText?: string; // AI extracted full text
  uploadedBy: string; // User ID
  uploadedAt: string;
  status?: 'processing' | 'completed' | 'failed'; // Background AI processing status
  jobId?: string;
}

export interface Acknowledgment {
  id: string;
  reportId: string;
  userId: string;
  acknowledgedAt: string;
}

export interface Comment {
  id: string;
  reportId: string;
  userId: string;
  content: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  action: 'login' | 'upload_report' | 'acknowledge_report' | 'view_report' | 'update_report' | 'delete_report';
  details: string;
  timestamp: string;
}
