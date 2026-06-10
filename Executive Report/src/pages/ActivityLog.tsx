import React, { useState, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { Search, Filter, Calendar, Download } from 'lucide-react';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';

export default function ActivityLog() {
  const { auditLogs, users } = useAppStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState('all');
  const [filterUser, setFilterUser] = useState('all');

  const getActionColor = (action: string) => {
    switch (action) {
      case 'login': return 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50';
      case 'upload_report': return 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800/50';
      case 'update_report': return 'bg-teal-100 dark:bg-teal-900/40 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800/50';
      case 'delete_report': return 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800/50';
      case 'acknowledge_report': return 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50';
      case 'view_report': return 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700';
      default: return 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700';
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'login': return 'เข้าสู่ระบบ';
      case 'upload_report': return 'อัปโหลดรายงาน';
      case 'update_report': return 'แก้ไขรายงาน';
      case 'delete_report': return 'ลบรายงาน';
      case 'acknowledge_report': return 'รับทราบรายงาน';
      case 'view_report': return 'เข้าดูรายงาน';
      default: return action;
    }
  };

  const filteredLogs = useMemo(() => {
    return auditLogs.filter(log => {
      const user = users.find(u => u.id === log.userId);
      const userName = user?.displayName || log.userId;
      
      const matchSearch = 
        log.details.toLowerCase().includes(searchTerm.toLowerCase()) || 
        userName.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchAction = filterAction === 'all' || log.action === filterAction;
      const matchUser = filterUser === 'all' || log.userId === filterUser;
      
      return matchSearch && matchAction && matchUser;
    }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [auditLogs, users, searchTerm, filterAction, filterUser]);

  const uniqueActions = Array.from(new Set(auditLogs.map(l => l.action)));

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 drop-shadow-sm transition-colors duration-200">บันทึกการใช้งานระบบ</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm font-medium transition-colors duration-200">Activity Log & Audit Trail</p>
        </div>
      </header>

      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-5 transition-colors duration-200">
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input
              type="text"
              placeholder="ค้นหารายละเอียด หรือชื่อผู้ใช้..."
              className="pl-10 w-full text-sm rounded bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 py-2 focus:ring-1 focus:ring-teal-500 outline-none transition-colors duration-200"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Filter className="h-4 w-4 text-slate-400" />
            </div>
            <select
              className="pl-10 w-full text-sm rounded bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 py-2 focus:ring-1 focus:ring-teal-500 outline-none transition-colors duration-200 appearance-none"
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
            >
              <option value="all">ทุกการกระทำ (All Actions)</option>
              {uniqueActions.map(action => (
                <option key={action} value={action}>{getActionLabel(action)}</option>
              ))}
            </select>
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Filter className="h-4 w-4 text-slate-400" />
            </div>
            <select
              className="pl-10 w-full text-sm rounded bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 py-2 focus:ring-1 focus:ring-teal-500 outline-none transition-colors duration-200 appearance-none"
              value={filterUser}
              onChange={(e) => setFilterUser(e.target.value)}
            >
              <option value="all">ทุกผู้ใช้งาน (All Users)</option>
              {users.map(user => (
                <option key={user.id} value={user.id}>{user.displayName}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded border border-slate-200 dark:border-slate-700">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 text-xs">
            <thead className="bg-slate-50 dark:bg-slate-900">
              <tr>
                <th className="px-4 py-3 text-left font-bold text-slate-600 dark:text-slate-400">วัน/เวลา</th>
                <th className="px-4 py-3 text-left font-bold text-slate-600 dark:text-slate-400">ผู้ใช้งาน</th>
                <th className="px-4 py-3 text-left font-bold text-slate-600 dark:text-slate-400">การกระทำ</th>
                <th className="px-4 py-3 text-left font-bold text-slate-600 dark:text-slate-400">รายละเอียด</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700 bg-white dark:bg-slate-800">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">ไม่มีข้อมูลที่ตรงตามเงื่อนไข</td>
                </tr>
              ) : filteredLogs.map((log) => {
                const user = users.find(u => u.id === log.userId);
                return (
                  <tr key={log.id} className="hover:bg-teal-50/30 dark:hover:bg-teal-900/20 transition-colors">
                    <td className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {format(new Date(log.timestamp), 'dd/MM/yyyy HH:mm:ss')}
                    </td>
                    <td className="px-4 py-3 text-slate-800 dark:text-slate-200 font-medium">
                      {user ? user.displayName : log.userId}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${getActionColor(log.action)}`}>
                        {getActionLabel(log.action)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400 border-l border-slate-100 dark:border-slate-700">
                      {log.details}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex justify-between items-center text-xs text-slate-500 dark:text-slate-400">
          <span>แสดง {filteredLogs.length} รายการ</span>
        </div>
      </div>
    </div>
  );
}
