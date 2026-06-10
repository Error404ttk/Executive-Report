import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAppStore } from './store/useAppStore';

// We will create these pages next
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import ReportsList from './pages/ReportsList';
import ReportDetail from './pages/ReportDetail';
import AdminPanel from './pages/AdminPanel';
import ActivityLog from './pages/ActivityLog';
import Layout from './components/Layout';

function PrivateRoute({ children, allowedRoles }: { children: React.ReactNode, allowedRoles?: string[] }) {
  const currentUser = useAppStore(state => state.currentUser);
  const token = useAppStore(state => state.token);
  
  if (!currentUser || !token) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(currentUser.role)) {
    return <Navigate to="/" replace />;
  }

  return <Layout>{children}</Layout>;
}

function useJobPoller() {
  const { reports, updateReportSilent, token } = useAppStore();

  useEffect(() => {
    if (!token) return;
    // interval to check jobs
    const interval = setInterval(() => {
      const processingReports = reports.filter(r => r.status === 'processing' && r.jobId);
      
      processingReports.forEach(async (report) => {
        try {
          const res = await fetch(`/api/jobs/${report.jobId}`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          if (res.ok) {
            const job = await res.json();
            if (job.status === 'completed') {
              updateReportSilent({
                ...report,
                status: 'completed',
                summary: job.result.summary,
                category: job.result.category,
                fullText: job.result.fullText
              });
            } else if (job.status === 'failed') {
               updateReportSilent({
                 ...report,
                 status: 'failed',
                 summary: 'ไม่สามารถสรุปข้อมูลได้: ' + (job.error || 'Server Error')
               });
            } else if (job.status === 'processing' && job.progress && job.progress !== report.summary) {
               updateReportSilent({
                 ...report,
                 summary: job.progress
               });
            }
          }
        } catch (e) {
          console.warn("Polling error for job", report.jobId);
        }
      });
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(interval);
  }, [reports, updateReportSilent, token]);
}

export default function App() {
  const { currentUser, theme, fetchData, token } = useAppStore();
  
  useJobPoller();

  // Load database from server and poll for changes to keep collaborative clients synced
  useEffect(() => {
    if (!token) return;
    fetchData();
    const interval = setInterval(() => {
      fetchData();
    }, 10000); // Poll every 10 seconds
    return () => clearInterval(interval);
  }, [fetchData, token]);

  // Handle theme body class
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);


  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
        
        <Route path="/reports/:category" element={<PrivateRoute><ReportsList /></PrivateRoute>} />
        <Route path="/report/:id" element={<PrivateRoute><ReportDetail /></PrivateRoute>} />

        <Route path="/admin" element={<PrivateRoute allowedRoles={['admin']}><AdminPanel /></PrivateRoute>} />
        <Route path="/admin/activity-log" element={<PrivateRoute allowedRoles={['admin']}><ActivityLog /></PrivateRoute>} />
      </Routes>
    </BrowserRouter>
  );
}
