import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { User, Agency, Report, Acknowledgment, Comment, ReportCategory, AuditLog } from '../types';

interface AppState {
  currentUser: User | null;
  token: string | null;
  users: User[];
  agencies: Agency[];
  reports: Report[];
  acknowledgments: Acknowledgment[];
  comments: Comment[];
  views: { reportId: string; userId: string; viewedAt: string }[];
  auditLogs: AuditLog[];
  theme: 'light' | 'dark';
  
  // Actions
  fetchData: () => Promise<void>;
  fetchReports: () => Promise<void>;
  fetchReportDetail: (id: string) => Promise<void>;
  login: (email: string, password?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  logAction: (userId: string, action: AuditLog['action'], details: string) => Promise<void>;
  setTheme: (theme: 'light' | 'dark') => void;
  
  // Admin actions
  addUser: (user: User, password?: string) => Promise<{ success: boolean; error?: string }>;
  updateUser: (user: User, password?: string) => Promise<{ success: boolean; error?: string }>;
  deleteUser: (id: string) => Promise<{ success: boolean; error?: string }>;
  
  addAgency: (agency: Agency) => Promise<{ success: boolean; error?: string }>;
  updateAgency: (agency: Agency) => Promise<{ success: boolean; error?: string }>;
  deleteAgency: (id: string) => Promise<{ success: boolean; error?: string }>;
  
  // Report actions
  addReport: (report: Report) => Promise<void>;
  updateReport: (report: Report, userId?: string) => Promise<void>; // userId optional: omit for silent (no audit log)
  updateReportSilent: (report: Report) => Promise<void>; // alias for updateReport without audit log (used by job poller)
  deleteReport: (id: string, userId: string, adminPassword?: string) => Promise<{ success: boolean; error?: string }>;
  retryReportAnalysis: (reportId: string) => Promise<{ success: boolean; error?: string }>;
  acknowledgeReport: (reportId: string, userId: string) => Promise<void>;
  markAsRead: (reportId: string, userId: string) => Promise<void>;
  addComment: (comment: Comment) => Promise<void>;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      currentUser: null,
      token: null,
      users: [],
      agencies: [],
      reports: [],
      acknowledgments: [],
      comments: [],
      views: [],
      auditLogs: [],
      theme: 'light',

      setTheme: (theme) => set({ theme }),

      fetchData: async () => {
        try {
          const res = await fetch('/api/data', {
            headers: {
              'Authorization': `Bearer ${get().token}`
            }
          });
          if (res.status === 401) {
            get().logout();
            return;
          }
          if (res.ok) {
            const data = await res.json();
            set({
              users: data.users || [],
              agencies: data.agencies || [],
              reports: data.reports || [],
              acknowledgments: data.acknowledgments || [],
              comments: data.comments || [],
              views: data.views || [],
              auditLogs: data.auditLogs || [],
            });
          }
        } catch (e) {
          console.error('Error fetching database from server', e);
        }
      },

      fetchReports: async () => {
        try {
          const res = await fetch('/api/reports', {
            headers: { 'Authorization': `Bearer ${get().token}` }
          });
          if (res.status === 401) { get().logout(); return; }
          if (res.ok) {
            const reports = await res.json();
            set({ reports: reports || [] });
          }
        } catch (e) {
          console.error('Error fetching reports', e);
        }
      },

      fetchReportDetail: async (id) => {
        try {
          const res = await fetch(`/api/reports/${id}`, {
            headers: {
              'Authorization': `Bearer ${get().token}`
            }
          });
          if (res.status === 401) {
            get().logout();
            return;
          }
          if (res.ok) {
            const detailReport = await res.json();
            set((state) => ({
              reports: state.reports.map(r => r.id === id ? detailReport : r)
            }));
          }
        } catch (e) {
          console.error('Error fetching report detail', e);
        }
      },

      login: async (email, password) => {
        try {
          const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
          });
          
          if (res.ok) {
            const data = await res.json();
            if (data.success && data.user && data.token) {
              set({ currentUser: data.user, token: data.token });
              await get().logAction(data.user.id, 'login', 'เข้าสู่ระบบ');
              return { success: true };
            }
          } else {
            const errData = await res.json().catch(() => ({}));
            return { success: false, error: errData.error || 'รหัสผ่านหรืออีเมลไม่ถูกต้อง' };
          }
        } catch (e) {
          return { success: false, error: 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้' };
        }
        return { success: false, error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' };
      },

      logout: () => set({ currentUser: null, token: null }),

      logAction: async (userId, action, details) => {
        const newLog = {
          id: self.crypto.randomUUID(),
          userId,
          action,
          details,
          timestamp: new Date().toISOString()
        };
        try {
          const res = await fetch('/api/audit-logs', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${get().token}`
            },
            body: JSON.stringify(newLog)
          });
          if (res.ok) {
            set((state) => ({ auditLogs: [...state.auditLogs, newLog] }));
          }
        } catch (e) {
          console.warn('Could not save audit log to server', e);
          set((state) => ({ auditLogs: [...state.auditLogs, newLog] }));
        }
      },

      addUser: async (user, password) => {
        const prevUsers = get().users; // snapshot for rollback
        set((state) => ({ users: [...state.users, user] })); // optimistic
        try {
          const res = await fetch('/api/users', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${get().token}`
            },
            body: JSON.stringify({ user, password })
          });
          if (res.ok) return { success: true };
          const errData = await res.json().catch(() => ({}));
          set({ users: prevUsers }); // rollback
          return { success: false, error: errData.error || 'ไม่สามารถเพิ่มผู้ใช้งานได้' };
        } catch (e: any) {
          set({ users: prevUsers }); // rollback
          return { success: false, error: 'ไม่สามารถติดต่อเซิร์ฟเวอร์ได้' };
        }
      },

      updateUser: async (user, password) => {
        const prevUsers = get().users; // snapshot for rollback
        set((state) => ({ users: state.users.map(u => u.id === user.id ? user : u) })); // optimistic
        try {
          const res = await fetch(`/api/users/${user.id}`, {
            method: 'PUT',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${get().token}`
            },
            body: JSON.stringify({ user, password })
          });
          if (res.ok) return { success: true };
          const errData = await res.json().catch(() => ({}));
          set({ users: prevUsers }); // rollback
          return { success: false, error: errData.error || 'ไม่สามารถอัปเดตผู้ใช้งานได้' };
        } catch (e: any) {
          set({ users: prevUsers }); // rollback
          return { success: false, error: 'ไม่สามารถติดต่อเซิร์ฟเวอร์ได้' };
        }
      },

      deleteUser: async (id) => {
        const currentUser = get().currentUser;
        try {
          const res = await fetch(`/api/users/${id}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${get().token}`,
              'X-Current-User-Id': currentUser?.id || ''
            }
          });
          if (res.ok) {
            set((state) => ({ users: state.users.filter(u => u.id !== id) }));
            return { success: true };
          }
          const errData = await res.json().catch(() => ({}));
          return { success: false, error: errData.error || 'ไม่สามารถลบผู้ใช้งานได้' };
        } catch (e: any) {
          return { success: false, error: 'ไม่สามารถติดต่อเซิร์ฟเวอร์ได้' };
        }
      },

      addAgency: async (agency) => {
        const prevAgencies = get().agencies;
        set((state) => ({ agencies: [...state.agencies, agency] })); // optimistic
        try {
          const res = await fetch('/api/agencies', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${get().token}`
            },
            body: JSON.stringify(agency)
          });
          if (res.ok) return { success: true };
          const errData = await res.json().catch(() => ({}));
          set({ agencies: prevAgencies }); // rollback
          return { success: false, error: errData.error || 'ไม่สามารถเพิ่มหน่วยงานได้' };
        } catch (e: any) {
          set({ agencies: prevAgencies }); // rollback
          return { success: false, error: 'ไม่สามารถติดต่อเซิร์ฟเวอร์ได้' };
        }
      },

      updateAgency: async (agency) => {
        const prevAgencies = get().agencies;
        set((state) => ({ agencies: state.agencies.map(a => a.id === agency.id ? agency : a) })); // optimistic
        try {
          const res = await fetch(`/api/agencies/${agency.id}`, {
            method: 'PUT',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${get().token}`
            },
            body: JSON.stringify(agency)
          });
          if (res.ok) return { success: true };
          const errData = await res.json().catch(() => ({}));
          set({ agencies: prevAgencies }); // rollback
          return { success: false, error: errData.error || 'ไม่สามารถอัปเดตหน่วยงานได้' };
        } catch (e: any) {
          set({ agencies: prevAgencies }); // rollback
          return { success: false, error: 'ไม่สามารถติดต่อเซิร์ฟเวอร์ได้' };
        }
      },

      deleteAgency: async (id) => {
        try {
          const res = await fetch(`/api/agencies/${id}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${get().token}`
            }
          });
          if (res.ok) {
            set((state) => ({ agencies: state.agencies.filter(a => a.id !== id) }));
            return { success: true };
          }
          const errData = await res.json().catch(() => ({}));
          return { success: false, error: errData.error || 'ไม่สามารถลบหน่วยงานได้' };
        } catch (e: any) {
          return { success: false, error: 'ไม่สามารถติดต่อเซิร์ฟเวอร์ได้' };
        }
      },

      addReport: async (report) => {
        const res = await fetch('/api/reports', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${get().token}`
          },
          body: JSON.stringify(report)
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'ไม่สามารถบันทึกรายงานได้');
        }
        const data = await res.json().catch(() => ({}));
        const savedReport = data.report || report;
        set((state) => ({ reports: [...state.reports, savedReport] }));
        await get().logAction(savedReport.uploadedBy, 'upload_report', `อัปโหลดรายงาน: ${savedReport.title}`);
      },

      // userId is optional: if provided, logs the action; omit for silent background updates (job poller)
      updateReport: async (report, userId?) => {
        try {
          const res = await fetch(`/api/reports/${report.id}`, {
            method: 'PUT',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${get().token}`
            },
            body: JSON.stringify(report)
          });
          if (res.ok) {
            set((state) => ({
              reports: state.reports.map(r => r.id === report.id ? report : r)
            }));
            if (userId) {
              await get().logAction(userId, 'update_report', `แก้ไขรายงาน: ${report.title}`);
            }
          }
        } catch (e) {
          console.error(e);
        }
      },

      // Alias kept for backward-compatibility with job poller in App.tsx
      updateReportSilent: async (report) => {
        set((state) => ({
          reports: state.reports.map(r => r.id === report.id ? report : r)
        }));
      },

      deleteReport: async (id, userId, adminPassword) => {
        const report = get().reports.find(r => r.id === id);
        try {
          const res = await fetch(`/api/reports/${id}`, {
            method: 'DELETE',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${get().token}`
            },
            body: JSON.stringify({ adminPassword })
          });
          if (res.ok) {
            set((state) => ({
              reports: state.reports.filter(r => r.id !== id)
            }));
            await get().logAction(userId, 'delete_report', `ลบรายงาน: ${report?.title || id}`);
            return { success: true };
          } else {
            const errData = await res.json().catch(() => ({}));
            return { success: false, error: errData.error || 'ไม่สามารถลบรายงานได้' };
          }
        } catch (e) {
          return { success: false, error: 'ไม่สามารถติดต่อเซิร์ฟเวอร์ได้' };
        }
      },

      retryReportAnalysis: async (reportId) => {
        try {
          const res = await fetch(`/api/reports/${reportId}/retry`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${get().token}`
            }
          });
          if (res.status === 401) {
            get().logout();
            return { success: false, error: 'Unauthorized' };
          }
          if (res.ok) {
            // Optimistically update local state to processing
            set((state) => ({
              reports: state.reports.map(r =>
                r.id === reportId
                  ? { ...r, status: 'processing', summary: 'กำลังวิเคราะห์ AI ใหม่อีกครั้ง...' }
                  : r
              )
            }));
            return { success: true };
          } else {
            const errData = await res.json().catch(() => ({}));
            return { success: false, error: errData.error || 'ไม่สามารถลองใหม่ได้' };
          }
        } catch (e) {
          return { success: false, error: 'ไม่สามารถติดต่อเซิร์ฟเวอร์ได้' };
        }
      },

      acknowledgeReport: async (reportId, userId) => {
        const report = get().reports.find(r => r.id === reportId);
        const newAck = {
          id: self.crypto.randomUUID(),
          reportId,
          userId,
          acknowledgedAt: new Date().toISOString()
        };
        try {
          const res = await fetch('/api/acknowledgments', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${get().token}`
            },
            body: JSON.stringify(newAck)
          });
          if (res.ok) {
            set((state) => ({
              acknowledgments: [...state.acknowledgments, newAck]
            }));
            await get().logAction(userId, 'acknowledge_report', `รับทราบรายงาน: ${report?.title || reportId}`);
          }
        } catch (e) {
          console.error(e);
        }
      },

      markAsRead: async (reportId, userId) => {
        const hasViewed = get().views.some(v => v.reportId === reportId && v.userId === userId);
        if (hasViewed) return;

        const report = get().reports.find(r => r.id === reportId);
        const newView = { reportId, userId, viewedAt: new Date().toISOString() };
        try {
          const res = await fetch('/api/views', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${get().token}`
            },
            body: JSON.stringify(newView)
          });
          if (res.ok) {
            set((state) => ({
              views: [...state.views, newView]
            }));
            await get().logAction(userId, 'view_report', `เปิดอ่านรายงาน: ${report?.title || reportId}`);
          }
        } catch (e) {
          console.error(e);
        }
      },

      addComment: async (comment) => {
        try {
          const res = await fetch('/api/comments', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${get().token}`
            },
            body: JSON.stringify(comment)
          });
          if (res.ok) {
            set((state) => ({ comments: [...state.comments, comment] }));
          }
        } catch (e) {
          console.error(e);
        }
      },
    }),
    {
      name: 'moph-executive-reports-storage',
      storage: createJSONStorage(() => sessionStorage), // sessionStorage: cleared on tab close, not accessible cross-tab (safer than localStorage)
      partialize: (state) => ({
        currentUser: state.currentUser,
        token: state.token,
        theme: state.theme,
      }),
    }
  )
);
