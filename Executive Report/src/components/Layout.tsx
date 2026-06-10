import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { NavLink, useNavigate, useLocation, Link } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { 
  BarChart3, FileText, Users, Settings, LogOut, 
  ShieldCheck, FileBadge, MessagesSquare, Laptop, Bell, Sun, Moon, Activity,
  Menu, X, PanelLeftClose, PanelLeftOpen
} from 'lucide-react';
import clsx from 'clsx';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import mophLogo from '../../MOPH Logo.png';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { currentUser, logout, reports, views, agencies, theme, setTheme } = useAppStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showReleaseNote, setShowReleaseNote] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => localStorage.getItem('sidebar-collapsed') === 'true');
  const notifRef = useRef<HTMLDivElement>(null);

  // --- Session Timeout Variables ---
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // 30 minutes in ms = 1800000, 28 minutes in ms = 1680000
  const IDLE_TIMEOUT = 30 * 60 * 1000;
  const WARNING_TIMEOUT = 28 * 60 * 1000;

  const handleLogout = useCallback(() => {
    setIsLoggingOut(true);
    setShowTimeoutWarning(false);
    setTimeout(() => {
      logout();
      navigate('/login', { replace: true });
    }, 1200);
  }, [logout, navigate]);

  const resetTimer = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);

    setShowTimeoutWarning(false);

    warningTimeoutRef.current = setTimeout(() => {
      setShowTimeoutWarning(true);
    }, WARNING_TIMEOUT);

    timeoutRef.current = setTimeout(() => {
      handleLogout();
    }, IDLE_TIMEOUT);
  }, [WARNING_TIMEOUT, IDLE_TIMEOUT, handleLogout]);

  useEffect(() => {
    if (!currentUser) return;

    resetTimer();

    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    
    // Throttle the reset to avoid running on every single pixel of mouse movement
    let throttleTimeout: NodeJS.Timeout | null = null;
    const handleUserActivity = () => {
      if (!throttleTimeout) {
        throttleTimeout = setTimeout(() => {
          resetTimer();
          throttleTimeout = null;
        }, 1000);
      }
    };

    events.forEach(event => {
      window.addEventListener(event, handleUserActivity);
    });

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
      if (throttleTimeout) clearTimeout(throttleTimeout);
      events.forEach(event => {
        window.removeEventListener(event, handleUserActivity);
      });
    };
  }, [currentUser, resetTimer]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', String(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  const unreadReports = useMemo(() =>
    reports
      .filter(r => !views.some(v => v.reportId === r.id && v.userId === currentUser?.id))
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()),
    [reports, views, currentUser?.id]
  );
  
  const unreadCount = unreadReports.length;

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  const navItems = [
    { to: '/', icon: BarChart3, label: 'แดชบอร์ด (Dashboard)', roles: ['admin', 'executive', 'user'] },
    { to: '/reports/agency', icon: FileText, label: 'รายงานระดับหน่วยงาน', roles: ['admin', 'executive', 'user'] },
    { to: '/reports/department', icon: FileBadge, label: 'รายงานฝ่าย', roles: ['admin', 'executive', 'user'] },
    { to: '/reports/meeting', icon: MessagesSquare, label: 'รายงานการประชุม', roles: ['admin', 'executive', 'user'] },
    { to: '/reports/audit', icon: ShieldCheck, label: 'รายงานตรวจสอบภายใน', roles: ['admin', 'executive'] },
    { to: '/reports/cyber', icon: Laptop, label: 'รายงาน Cyber', roles: ['admin', 'executive'] },
    { to: '/admin', icon: Settings, label: 'ผู้ดูแลระบบ (Admin)', roles: ['admin'] },
    { to: '/admin/activity-log', icon: Activity, label: 'บันทึกการใช้งาน (Activity Log)', roles: ['admin'] },
  ];

  return (
    <div className="flex h-dvh min-h-0 bg-[#F0F7F4] dark:bg-slate-900 flex-col overflow-hidden border-2 sm:border-4 border-[#009688] dark:border-teal-900 transition-colors duration-200">
      {/* Header */}
      <header className="bg-[#009688] dark:bg-teal-950 text-white px-2.5 py-2 sm:px-4 sm:py-3 flex justify-between items-center gap-2 shadow-md z-50 shrink-0 transition-colors duration-200">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(true)}
            className="md:hidden p-2 hover:bg-teal-700 dark:hover:bg-teal-800 rounded-lg transition-colors shrink-0"
            aria-label="เปิดเมนูหลัก"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="bg-white p-1 rounded-full dark:bg-teal-900 shrink-0">
            <img src={mophLogo} 
                 alt="MOPH Logo" 
                 className="h-7 w-7 sm:h-8 sm:w-8 object-contain"
            />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-xl font-bold leading-tight uppercase text-white truncate">Executive Report</h1>
            <p className="hidden sm:block text-xs text-white opacity-90 dark:opacity-75 truncate">โรงพยาบาลสารภี Saraphi Hospital</p>
          </div>
        </div>
        <div className="flex items-center gap-0.5 sm:gap-2 shrink-0">
            <div className="text-right border-r border-teal-400 dark:border-teal-800 pr-3 hidden lg:block max-w-56">
              <p className="text-sm font-semibold">{currentUser?.displayName}</p>
              <p className="text-[10px] bg-teal-700 dark:bg-teal-800 px-2 rounded-full mt-0.5 inline-block">สิทธิ์การใช้งาน: {currentUser?.role === 'admin' ? 'ผู้ดูแลระบบ' : currentUser?.role === 'executive' ? 'ผู้บริหารระดับสูง' : 'ผู้ใช้งานทั่วไป'}</p>
            </div>
            
            <button
              onClick={toggleTheme}
              className="p-2 hover:bg-teal-700 dark:hover:bg-teal-800 rounded-lg transition-colors"
              aria-label="Toggle Theme"
            >
              {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            </button>
            
            <div className="relative" ref={notifRef}>
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 hover:bg-teal-700 dark:hover:bg-teal-800 rounded-lg transition-colors relative"
              >
                <Bell className="h-5 w-5 sm:h-6 sm:w-6" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 bg-rose-500 text-white text-[10px] font-bold h-4 w-4 rounded-full flex items-center justify-center">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="fixed left-3 right-3 top-14 sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-80 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden z-[70]">
                  <div className="p-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex justify-between items-center">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">การแจ้งเตือน</h3>
                    {unreadCount > 0 && (
                      <span className="text-xs text-rose-500 font-semibold">{unreadCount} รายการใหม่</span>
                    )}
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {unreadReports.length > 0 ? (
                      unreadReports.slice(0, 10).map(report => (
                        <Link 
                          key={report.id} 
                          to={`/report/${report.id}`}
                          onClick={() => setShowNotifications(false)}
                          className="block p-3 border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                        >
                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{report.title}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex justify-between">
                            <span>{agencies.find(a => a.id === report.agencyId)?.name || 'กระทรวงสาธารณสุข'}</span>
                            <span>{format(new Date(report.uploadedAt), 'dd/MM/yy', { locale: th })}</span>
                          </p>
                        </Link>
                      ))
                    ) : (
                      <div className="p-4 text-center text-sm text-slate-500 dark:text-slate-400">
                        ไม่มีการแจ้งเตือนใหม่
                      </div>
                    )}
                  </div>
                  {unreadReports.length > 10 && (
                    <div className="p-2 text-center border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                      <span className="text-xs text-slate-500 dark:text-slate-400">ยังมีอีก {unreadReports.length - 10} รายการ</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <button 
              onClick={handleLogout}
              className="p-2 hover:bg-teal-700 dark:hover:bg-teal-800 rounded-lg transition-colors"
            >
              <LogOut className="h-5 w-5 sm:h-6 sm:w-6" />
            </button>
          </div>
      </header>

      <div className="flex flex-1 min-h-0 overflow-hidden relative">
        {isMobileMenuOpen && (
          <button
            type="button"
            className="fixed inset-0 z-30 bg-slate-950/45 backdrop-blur-[1px] md:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-label="ปิดเมนูหลัก"
          />
        )}

        {/* Sidebar */}
        <aside className={clsx(
          "fixed inset-y-0 left-0 z-40 w-[min(18rem,86vw)] bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex-shrink-0 flex flex-col overflow-hidden shadow-2xl transition-[transform,width] duration-200 md:static md:translate-x-0 md:shadow-none",
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full",
          isSidebarCollapsed ? "md:w-20" : "md:w-64"
        )}>
          <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">เมนูหลัก</span>
            <button type="button" onClick={() => setIsMobileMenuOpen(false)} className="p-2 rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700" aria-label="ปิดเมนู">
              <X className="h-5 w-5" />
            </button>
          </div>
          <nav className={clsx("flex-1 overflow-y-auto space-y-1", isSidebarCollapsed ? "md:p-3" : "p-4")}>
            <p className={clsx("text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-2", isSidebarCollapsed && "md:hidden")}>เมนูหลัก / ประเภทรายงาน</p>
            {navItems.filter(item => item.roles.includes(currentUser?.role || '')).map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                title={isSidebarCollapsed ? item.label : undefined}
                className={({ isActive }) => clsx(
                  "flex items-center min-h-10 rounded-md text-sm font-medium transition-colors",
                  isSidebarCollapsed ? "md:justify-center md:px-2 gap-3 px-3" : "gap-3 px-3",
                  isActive 
                    ? "bg-teal-50 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 border-l-4 border-teal-600 dark:border-teal-500" 
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                <span className={clsx("leading-snug", isSidebarCollapsed && "md:hidden")}>{item.label}</span>
              </NavLink>
            ))}
          </nav>
          <button
            type="button"
            onClick={() => setIsSidebarCollapsed(value => !value)}
            className="hidden md:flex items-center justify-center gap-2 min-h-12 border-t border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50"
            title={isSidebarCollapsed ? 'ขยายเมนู' : 'ย่อเมนู'}
          >
            {isSidebarCollapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
            {!isSidebarCollapsed && <span>ย่อเมนู</span>}
          </button>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0 overflow-y-auto overscroll-contain p-3 sm:p-5 lg:p-7 bg-transparent">
          <div className="w-full max-w-screen-2xl mx-auto">
            {children}
          </div>
        </main>
      </div>

      {/* Footer */}
      <footer className="bg-slate-100 dark:bg-slate-800 border-t border-slate-300 dark:border-slate-700 px-3 sm:px-6 py-1.5 flex flex-wrap justify-between items-center gap-1.5 shrink-0 mt-auto transition-colors duration-200">
        <div className="flex items-center space-x-4">
          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium italic">v.{format(new Date(), 'ddMMyyyy', { locale: th })}</p>
          <button
            onClick={() => setShowReleaseNote(true)}
            className="hidden sm:inline text-[10px] text-teal-600 dark:text-teal-400 hover:underline font-medium cursor-pointer"
          >
            📋 Release Notes — v.1.0.0
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-600 dark:text-slate-400">
          <span className="hidden sm:inline font-bold">อัปเดตล่าสุด:</span>
          <span className="hidden sm:inline">{format(new Date(), 'dd MMM yy HH:mm', { locale: th })} น.</span>
          <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full border border-green-200 dark:border-green-800/50">Connected</span>
        </div>
      </footer>

      {/* Release Notes Modal */}
      {showReleaseNote && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowReleaseNote(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
              <div>
                <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">📋 Release Notes</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Executive Report — โรงพยาบาลสารภี</p>
              </div>
              <button onClick={() => setShowReleaseNote(false)} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="overflow-y-auto max-h-[60vh] divide-y divide-slate-100 dark:divide-slate-700">
              {[
                {
                  version: 'v.1.0.0',
                  date: '10 มิ.ย. 2568',
                  label: 'Stable Build',
                  labelColor: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
                  items: [
                    'เปิดตัวระบบอัปโหลดเอกสาร PDF พร้อมสรุปโดย AI',
                    'ระบบแบ่งสิทธิ์ Admin / Executive / User',
                    'แดชบอร์ดสรุปบทำงานและสถิติผู้ใช้งาน',
                    'ระบบแจ้งเตือนรายงานใหม่ (Bell Notification)',
                    'ระบบสรุปใจความสำคัญ (Bullet Points) ด้วย Gemini AI',
                    'ปุ่ม Retry สำหรับรายงานที่วิเคราะห์ AI ไม่สำเร็จ',
                    'ระบบออกจากระบบอัตโนมัติเมื่อไม่มีการใช้งาน 30 นาที',
                    'Dark Mode และ Audit Log',
                  ],
                },
              ].map((release) => (
                <div key={release.version} className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-800 dark:text-slate-100">{release.version}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${release.labelColor}`}>{release.label}</span>
                    </div>
                    <span className="text-[10px] text-slate-400">{release.date}</span>
                  </div>
                  <ul className="space-y-1.5">
                    {release.items.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300">
                        <span className="text-teal-500 mt-0.5 shrink-0">✓</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-center">
              <p className="text-[10px] text-slate-400">แจ้งปัญหาหรือสอบถามทีมพัฒนาและผู้ดูแลระบบ</p>
            </div>
          </div>
        </div>
      )}

      {/* Session Timeout Warning Modal */}
      {showTimeoutWarning && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-xl max-w-sm w-full mx-4 border border-slate-200 dark:border-slate-700">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2">
              เซสชันกำลังจะหมดเวลา
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
              ระบบไม่พบการใช้งานของคุณเป็นเวลา 28 นาที เพื่อความปลอดภัย ระบบจะออกจากระบบอัตโนมัติในอีก 2 นาที หากคุณต้องการใช้งานต่อ กรุณากดปุ่มด้านล่าง
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded transition-colors"
              >
                ออกจากระบบ (Logout)
              </button>
              <button
                onClick={resetTimer}
                className="px-4 py-2 text-sm font-bold text-white bg-teal-600 hover:bg-teal-700 rounded transition-colors"
              >
                ใช้งานต่อ (Continue)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Logging Out Overlay */}
      {isLoggingOut && (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm transition-all duration-300">
          <svg className="animate-spin h-10 w-10 text-teal-600 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-teal-700 dark:text-teal-400 font-bold text-lg animate-pulse">กำลังออกจากระบบ (Logging out)...</p>
        </div>
      )}
    </div>
  );
}
