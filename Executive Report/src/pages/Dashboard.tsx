import React, { useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { FileText, Users, Clock, ShieldCheck, Activity, BarChart2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format, subDays, isAfter, startOfDay, parseISO } from 'date-fns';
import { th } from 'date-fns/locale';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, PieChart, Pie, Cell
} from 'recharts';

export default function Dashboard() {
  const { currentUser, reports, agencies, acknowledgments, users, auditLogs } = useAppStore();

  const isExecutiveOrAdmin = currentUser?.role === 'admin' || currentUser?.role === 'executive';

  const stats = useMemo(() => {
    const s = [
      { label: 'รายงานทั้งหมด', value: reports.length, icon: FileText, color: 'text-blue-600', bg: 'bg-blue-100' },
      currentUser?.role === 'executive' ? (
        { label: 'รับทราบแล้ว', value: acknowledgments.filter(a => a.userId === currentUser?.id).length, icon: ShieldCheck, color: 'text-green-600', bg: 'bg-green-100' }
      ) : (
        { label: 'ผู้บริหารรับทราบแล้ว', value: reports.filter(r => acknowledgments.some(a => a.reportId === r.id)).length, icon: ShieldCheck, color: 'text-green-600', bg: 'bg-green-100' }
      ),
      currentUser?.role === 'executive' ? (
        { label: 'รอการรับทราบ', value: reports.length - acknowledgments.filter(a => a.userId === currentUser?.id).length, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-100' }
      ) : (
        { label: 'รอผู้บริหารรับทราบ', value: reports.filter(r => !acknowledgments.some(a => a.reportId === r.id)).length, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-100' }
      ),
    ];

    if (isExecutiveOrAdmin) {
      s.push({ label: 'หน่วยงานในระบบ', value: agencies.length, icon: Users, color: 'text-purple-600', bg: 'bg-purple-100' });
    }
    return s;
  }, [reports, acknowledgments, currentUser, isExecutiveOrAdmin, agencies]);

  const recentReports = useMemo(() => {
    return [...reports].sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()).slice(0, 5);
  }, [reports]);

  // Chart 1: Report Submission Trends (Last 30 Days)
  const reportTrendsData = useMemo(() => {
    const thirtyDaysAgo = startOfDay(subDays(new Date(), 30));
    const daysMap = new Map();
    
    for (let i = 0; i <= 30; i++) {
        const d = subDays(new Date(), 30 - i);
        daysMap.set(format(d, 'dd MMM', { locale: th }), 0);
    }

    reports.forEach(report => {
        const d = parseISO(report.uploadedAt);
        if (isAfter(d, thirtyDaysAgo)) {
            const key = format(d, 'dd MMM', { locale: th });
            if (daysMap.has(key)) {
                daysMap.set(key, daysMap.get(key) + 1);
            }
        }
    });

    return Array.from(daysMap.entries()).map(([date, count]) => ({ date, count }));
  }, [reports]);

  // Chart 2: Acknowledgement rates per department
  const agencyAckData = useMemo(() => {
    return agencies.map(agency => {
        const agencyUsers = users.filter(u => u.agencyId === agency.id);
        const agencyUserIds = agencyUsers.map(u => u.id);
        
        const acks = acknowledgments.filter(ack => agencyUserIds.includes(ack.userId)).length;
        
        // Target: Total reports * number of users in agency (simplistic maximum possible acks)
        const totalPossible = reports.length * agencyUsers.length;
        
        return {
            name: agency.name,
            'รับทราบแล้ว': acks,
            'รอรับทราบ': totalPossible > acks ? totalPossible - acks : 0
        };
    });
  }, [agencies, users, acknowledgments, reports]);

  // Chart 3: Activity Levels (Audit Logs) over the last 30 days
  const activityData = useMemo(() => {
    const thirtyDaysAgo = startOfDay(subDays(new Date(), 30));
    const daysMap = new Map();
    
    for (let i = 0; i <= 30; i++) {
        const d = subDays(new Date(), 30 - i);
        daysMap.set(format(d, 'dd MMM', { locale: th }), { date: format(d, 'dd MMM', { locale: th }), login: 0, upload: 0, ack: 0, view: 0 });
    }

    (auditLogs || []).forEach(log => {
        const d = parseISO(log.timestamp);
        if (isAfter(d, thirtyDaysAgo)) {
            const key = format(d, 'dd MMM', { locale: th });
            const entry = daysMap.get(key);
            if (entry) {
                if (log.action === 'login') entry.login++;
                else if (log.action === 'upload_report') entry.upload++;
                else if (log.action === 'acknowledge_report') entry.ack++;
                else if (log.action === 'view_report') entry.view++;
                daysMap.set(key, entry);
            }
        }
    });

    return Array.from(daysMap.values());
  }, [auditLogs]);

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

  const recentReportsSection = (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden transition-colors duration-200">
      <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900 border-b-2">
        <h2 className="text-sm font-bold text-[#00796B] dark:text-[#26A69A]">รายงานล่าสุด</h2>
        <Link to="/reports/all" className="text-[10px] text-slate-400 dark:text-slate-500 font-medium hover:text-[#009688] dark:hover:text-[#4DB6AC]">ดูทั้งหมด</Link>
      </div>
      
      {recentReports.length > 0 ? (
        <ul className="divide-y divide-slate-100 dark:divide-slate-700">
          {recentReports.map(report => {
            const isAcknowledged = acknowledgments.some(a => a.reportId === report.id && a.userId === currentUser?.id);
            
            return (
              <li key={report.id} className="p-4 flex items-start gap-4 hover:bg-teal-50 dark:hover:bg-slate-700 bg-teal-50/10 dark:bg-slate-800/50 cursor-pointer transition-colors border-b border-slate-100 dark:border-slate-700">
                <div className="p-2 bg-teal-100 dark:bg-teal-900 text-teal-700 dark:text-teal-300 rounded border border-teal-200 dark:border-teal-700 shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <Link to={`/report/${report.id}`} className="text-sm font-bold text-slate-800 dark:text-slate-200 hover:text-teal-700 dark:hover:text-teal-400 truncate block">
                    {report.title}
                  </Link>
                  <div className="mt-1 flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                    <span className="capitalize bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded text-[10px] font-bold text-slate-600 dark:text-slate-300 border dark:border-slate-600">
                      หมวดหมู่: {report.category}
                    </span>
                    <span>{new Date(report.uploadedAt).toLocaleString('th-TH')}</span>
                  </div>
                </div>
                <div>
                  {currentUser?.role === 'executive' ? (
                    isAcknowledged ? (
                      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold bg-teal-50 dark:bg-teal-900/40 text-teal-700 dark:text-teal-400 border border-teal-200 dark:border-teal-800">
                        รับทราบแล้ว
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold bg-amber-50 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50">
                        รอการรับทราบ
                      </span>
                    )
                  ) : (
                    acknowledgments.some(a => a.reportId === report.id) ? (
                      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold bg-teal-50 dark:bg-teal-900/40 text-teal-700 dark:text-teal-400 border border-teal-200 dark:border-teal-800">
                        ผู้บริหารรับทราบแล้ว
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold bg-amber-50 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50">
                        รอผู้บริหารรับทราบ
                      </span>
                    )
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="p-12 text-center text-slate-500 dark:text-slate-400 text-sm font-medium">
          ไม่มีรายงานในระบบขณะนี้
        </div>
      )}
    </div>
  );

  const chartsSection = isExecutiveOrAdmin && (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Chart 1: Report Submission Trends */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-5 transition-colors duration-200">
        <div className="flex items-center gap-2 mb-4">
          <BarChart2 className="w-5 h-5 text-indigo-500" />
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">แนวโน้มการส่งรายงาน (30 วันย้อนหลัง)</h2>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={reportTrendsData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip 
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                itemStyle={{ color: '#0f172a', fontSize: '12px', fontWeight: 'bold' }}
                labelStyle={{ color: '#64748b', fontSize: '10px', marginBottom: '4px' }}
              />
              <Area type="monotone" dataKey="count" name="จำนวนรายงาน" stroke="#6366f1" fillOpacity={1} fill="url(#colorCount)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Chart 2: Acknowledgement Rate per Department */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-5 transition-colors duration-200">
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck className="w-5 h-5 text-teal-500" />
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">การรับทราบรายงานแยกตามหน่วยงาน</h2>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={agencyAckData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <Tooltip 
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                labelStyle={{ color: '#64748b', fontSize: '10px', marginBottom: '4px' }}
                cursor={{fill: '#f8fafc'}}
              />
              <Legend wrapperStyle={{ fontSize: '10px' }} />
              <Bar dataKey="รับทราบแล้ว" stackId="a" fill="#10b981" radius={[0, 0, 4, 4]} />
              <Bar dataKey="รอรับทราบ" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Chart 3: Activity Levels */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-5 lg:col-span-2 transition-colors duration-200">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-5 h-5 text-rose-500" />
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">ระดับกิจกรรมการใช้งาน (30 วันย้อนหลัง)</h2>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={activityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip 
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                labelStyle={{ color: '#64748b', fontSize: '10px', marginBottom: '4px' }}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Area type="monotone" dataKey="view" name="ดูรายงาน" stackId="1" stroke="#94a3b8" fill="#cbd5e1" />
              <Area type="monotone" dataKey="login" name="เข้าสู่ระบบ" stackId="1" stroke="#38bdf8" fill="#7dd3fc" />
              <Area type="monotone" dataKey="ack" name="รับทราบ" stackId="1" stroke="#34d399" fill="#6ee7b7" />
              <Area type="monotone" dataKey="upload" name="อัปโหลด" stackId="1" stroke="#a78bfa" fill="#c4b5fd" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 drop-shadow-sm transition-colors duration-200">ยินดีต้อนรับสู่แดชบอร์ด</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm font-medium transition-colors duration-200">ภาพรวมรายงานและการจัดการสำหรับผู้บริหาร</p>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <div key={i} className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-5 border border-slate-200 dark:border-slate-700 flex items-center gap-4 transition-colors duration-200">
            <div className={`p-3 rounded-md ${stat.bg} dark:opacity-80`}>
              <stat.icon className={`w-6 h-6 ${stat.color}`} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">{stat.label}</p>
              <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {recentReportsSection}
      {chartsSection}
    </div>
  );
}
