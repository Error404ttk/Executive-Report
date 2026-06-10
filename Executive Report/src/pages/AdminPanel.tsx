import React, { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { User, Agency, AuditLog } from '../types';
import { Plus, Edit2, Trash2, Shield, Building, UserCircle, Activity, X } from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';

export default function AdminPanel() {
  const { users, agencies, auditLogs, addUser, updateUser, deleteUser, addAgency, updateAgency, deleteAgency } = useAppStore();
  
  const [activeTab, setActiveTab] = useState<'users' | 'agencies' | 'audit'>('users');

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-800 drop-shadow-sm">การตั้งค่าผู้ดูแลระบบ</h1>
        <p className="text-slate-500 mt-1 text-sm font-medium">จัดการผู้ใช้งาน หน่วยงาน และข้อมูลระบบ</p>
      </header>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="flex border-b border-slate-200">
          <button 
            type="button"
            className={`flex-1 py-4 px-6 text-sm font-bold flex items-center justify-center gap-2 ${activeTab === 'users' ? 'text-[#009688] border-b-2 border-[#009688] bg-teal-50/50' : 'text-slate-500 hover:text-slate-700 bg-slate-50'}`}
            onClick={() => setActiveTab('users')}
          >
            <UserCircle className="w-5 h-5" />
            ผู้ใช้งานระบบ
          </button>
          <button 
            type="button"
            className={`flex-1 py-4 px-6 text-sm font-bold flex items-center justify-center gap-2 ${activeTab === 'agencies' ? 'text-[#009688] border-b-2 border-[#009688] bg-teal-50/50' : 'text-slate-500 hover:text-slate-700 bg-slate-50'}`}
            onClick={() => setActiveTab('agencies')}
          >
            <Building className="w-5 h-5" />
            หน่วยงาน
          </button>
          <button 
            type="button"
            className={`flex-1 py-4 px-6 text-sm font-bold flex items-center justify-center gap-2 ${activeTab === 'audit' ? 'text-[#009688] border-b-2 border-[#009688] bg-teal-50/50' : 'text-slate-500 hover:text-slate-700 bg-slate-50'}`}
            onClick={() => setActiveTab('audit')}
          >
            <Activity className="w-5 h-5" />
            Audit Trail
          </button>
        </div>

        <div className="p-6">
          {activeTab === 'users' && <UsersManager users={users} agencies={agencies} addUser={addUser} updateUser={updateUser} deleteUser={deleteUser} />}
          {activeTab === 'agencies' && <AgenciesManager agencies={agencies} addAgency={addAgency} updateAgency={updateAgency} deleteAgency={deleteAgency} />}
          {activeTab === 'audit' && <AuditTrailManager auditLogs={auditLogs} users={users} />}
        </div>
      </div>
    </div>
  );
}

// ----- Users Manager -----
function UsersManager({ users, agencies, addUser, updateUser, deleteUser }: any) {
  const { currentUser } = useAppStore();
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean; userId: string; userName: string } | null>(null);

  // Form states
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<'admin' | 'executive' | 'user'>('user');
  const [agencyId, setAgencyId] = useState('');
  const [password, setPassword] = useState('');

  const openAddModal = () => {
    setEditingUser(null);
    setEmail('');
    setDisplayName('');
    setRole('user');
    setAgencyId(agencies[0]?.id || '');
    setPassword('');
    setShowModal(true);
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setEmail(user.email);
    setDisplayName(user.displayName);
    setRole(user.role);
    setAgencyId(user.agencyId || '');
    setPassword('');
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !displayName) return;

    if (editingUser) {
      // Edit mode
      await updateUser({
        ...editingUser,
        email,
        displayName,
        role,
        agencyId: agencyId || undefined
      }, password || undefined);
    } else {
      // Add mode
      if (!password) {
        alert('กรุณากำหนดรหัสผ่านสำหรับผู้ใช้ใหม่');
        return;
      }
      await addUser({
        id: self.crypto.randomUUID(),
        email,
        displayName,
        role,
        agencyId: agencyId || undefined
      }, password);
    }
    setShowModal(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-sm font-bold text-slate-800">จัดการผู้ใช้งาน ({users.length})</h2>
        <button type="button" onClick={openAddModal} className="inline-flex items-center gap-2 px-3 py-2 bg-[#009688] text-white text-xs font-bold rounded shadow-sm hover:opacity-90 transition-opacity cursor-pointer">
          <Plus className="w-4 h-4" /> เพิ่มผู้ใช้งาน
        </button>
      </div>

      <div className="overflow-x-auto rounded border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-xs">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left font-bold text-slate-600">ชื่อ - สกุล</th>
              <th className="px-4 py-3 text-left font-bold text-slate-600">อีเมล</th>
              <th className="px-4 py-3 text-left font-bold text-slate-600">บทบาท (Role)</th>
              <th className="px-4 py-3 text-left font-bold text-slate-600">หน่วยงาน</th>
              <th className="px-4 py-3 text-right font-bold text-slate-600">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {users.map((user: User) => (
              <tr key={user.id} className="hover:bg-teal-50/30 transition-colors">
                <td className="px-4 py-3 font-semibold text-slate-800">{user.displayName}</td>
                <td className="px-4 py-3 text-slate-500">{user.email}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase
                    ${user.role === 'admin' ? 'bg-purple-100 text-purple-800 border border-purple-200' : 
                      user.role === 'executive' ? 'bg-teal-100 text-teal-800 border border-teal-200' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                    {user.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-500">{agencies.find((a: Agency) => a.id === user.agencyId)?.name || '-'}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => openEditModal(user)} className="p-1 text-slate-400 hover:text-teal-600 cursor-pointer" title="แก้ไขข้อมูลผู้ใช้งาน"><Edit2 className="w-4 h-4" /></button>
                    {user.id !== currentUser?.id ? (
                      <button 
                        type="button" 
                        onClick={() => setConfirmDelete({ isOpen: true, userId: user.id, userName: user.displayName })} 
                        className="p-1 text-slate-400 hover:text-red-600 cursor-pointer" 
                        title="ลบผู้ใช้งาน"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    ) : (
                      <button type="button" className="p-1 text-slate-200 cursor-not-allowed" title="ไม่สามารถลบผู้ใช้งานที่กำลังล็อกอินอยู่ได้" disabled><Trash2 className="w-4 h-4" /></button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* User Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden border border-slate-100 transform transition-all scale-100">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <h3 className="text-sm font-bold text-slate-800">
                {editingUser ? 'แก้ไขข้อมูลผู้ใช้งาน' : 'เพิ่มผู้ใช้งานระบบใหม่'}
              </h3>
              <button type="button" onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4 text-slate-700">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">ชื่อ - สกุล</label>
                <input 
                  type="text" 
                  required
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="เช่น สมชาย ใจดี"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-teal-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">อีเมลผู้ใช้งาน</label>
                <input 
                  type="email" 
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="เช่น somchai@moph.go.th"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-teal-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">บทบาท (Role)</label>
                  <select 
                    value={role}
                    onChange={e => setRole(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded bg-white focus:ring-1 focus:ring-teal-500 outline-none"
                  >
                    <option value="user">User (ผู้ใช้งานทั่วไป)</option>
                    <option value="executive">Executive (ผู้บริหาร)</option>
                    <option value="admin">Admin (ผู้ดูแลระบบ)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">หน่วยงาน</label>
                  <select 
                    value={agencyId}
                    onChange={e => setAgencyId(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded bg-white focus:ring-1 focus:ring-teal-500 outline-none"
                  >
                    <option value="">ไม่มีสังกัด</option>
                    {agencies.map((a: Agency) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">
                  รหัสผ่าน {editingUser && <span className="text-[10px] text-slate-400 font-normal">(เว้นว่างเพื่อคงรหัสผ่านเดิม)</span>}
                </label>
                <input 
                  type="password" 
                  required={!editingUser}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={editingUser ? "เปลี่ยนรหัสผ่านใหม่..." : "ระบุรหัสผ่านเข้าใช้งาน..."}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-teal-500 outline-none"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)} 
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#009688] hover:bg-teal-700 rounded-lg transition-colors shadow-sm cursor-pointer"
                >
                  บันทึกข้อมูล
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmDelete && (
        <ConfirmModal
          isOpen={confirmDelete.isOpen}
          title="ยืนยันการลบผู้ใช้งาน"
          message={`คุณต้องการลบผู้ใช้งาน "${confirmDelete.userName}" ออกจากระบบใช่หรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้`}
          confirmText="ลบผู้ใช้งาน"
          cancelText="ยกเลิก"
          type="danger"
          onConfirm={async () => {
            await deleteUser(confirmDelete.userId);
            setConfirmDelete(null);
          }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}

// ----- Agencies Manager -----
function AgenciesManager({ agencies, addAgency, updateAgency, deleteAgency }: any) {
  const [showModal, setShowModal] = useState(false);
  const [editingAgency, setEditingAgency] = useState<Agency | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean; agencyId: string; agencyName: string } | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const openAddModal = () => {
    setEditingAgency(null);
    setName('');
    setDescription('');
    setShowModal(true);
  };

  const openEditModal = (agency: Agency) => {
    setEditingAgency(agency);
    setName(agency.name);
    setDescription(agency.description || '');
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    if (editingAgency) {
      // Edit mode
      await updateAgency({
        ...editingAgency,
        name,
        description
      });
    } else {
      // Add mode
      await addAgency({
        id: self.crypto.randomUUID(),
        name,
        description,
        createdAt: new Date().toISOString()
      });
    }
    setShowModal(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-sm font-bold text-slate-800">จัดการหน่วยงาน ({agencies.length})</h2>
        <button type="button" onClick={openAddModal} className="inline-flex items-center gap-2 px-3 py-2 bg-[#009688] text-white text-xs font-bold rounded shadow-sm hover:opacity-90 transition-opacity cursor-pointer">
          <Plus className="w-4 h-4" /> เพิ่มหน่วยงาน
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {agencies.map((agency: Agency) => (
           <div key={agency.id} className="border border-slate-200 rounded p-4 flex justify-between items-start bg-slate-50 hover:bg-white hover:border-[#009688] transition-colors">
              <div>
                <h3 className="font-bold text-sm text-slate-800">{agency.name}</h3>
                <p className="text-xs text-slate-500 mt-1">{agency.description || 'ไม่มีรายละเอียด'}</p>
                <p className="text-[10px] text-slate-400 mt-3 font-bold">เพิ่มเมื่อ: {new Date(agency.createdAt).toLocaleDateString('th-TH')}</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => openEditModal(agency)} className="p-1.5 text-slate-400 hover:text-teal-600 bg-white border border-slate-200 rounded shadow-sm cursor-pointer" title="แก้ไขหน่วยงาน"><Edit2 className="w-4 h-4" /></button>
                <button 
                  type="button" 
                  onClick={() => setConfirmDelete({ isOpen: true, agencyId: agency.id, agencyName: agency.name })} 
                  className="p-1.5 text-slate-400 hover:text-red-600 bg-white border border-slate-200 rounded shadow-sm cursor-pointer" 
                  title="ลบหน่วยงาน"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
           </div>
        ))}
      </div>

      {/* Agency Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden border border-slate-100 transform transition-all scale-100">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <h3 className="text-sm font-bold text-slate-800">
                {editingAgency ? 'แก้ไขข้อมูลหน่วยงาน' : 'เพิ่มหน่วยงานใหม่'}
              </h3>
              <button type="button" onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4 text-slate-700">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">ชื่อหน่วยงาน</label>
                <input 
                  type="text" 
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="เช่น กองยุทธศาสตร์และแผนงาน"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-teal-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">รายละเอียดหน่วยงาน</label>
                <textarea 
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="ใส่คำอธิบายเพิ่มเติมเกี่ยวกับหน่วยงาน..."
                  rows={3}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-teal-500 outline-none resize-none"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)} 
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#009688] hover:bg-teal-700 rounded-lg transition-colors shadow-sm cursor-pointer"
                >
                  บันทึกข้อมูล
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmDelete && (
        <ConfirmModal
          isOpen={confirmDelete.isOpen}
          title="ยืนยันการลบหน่วยงาน"
          message={`คุณต้องการลบหน่วยงาน "${confirmDelete.agencyName}" ใช่หรือไม่? ผู้ใช้งานในสังกัดหน่วยงานนี้จะกลายเป็นไม่มีสังกัด`}
          confirmText="ลบหน่วยงาน"
          cancelText="ยกเลิก"
          type="danger"
          onConfirm={async () => {
            await deleteAgency(confirmDelete.agencyId);
            setConfirmDelete(null);
          }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}

// ----- Audit Trail Manager -----
function AuditTrailManager({ auditLogs, users }: { auditLogs: AuditLog[], users: User[] }) {
  const sortedLogs = [...(auditLogs || [])].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const getActionColor = (action: string) => {
    switch(action) {
      case 'login': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'upload_report': return 'bg-green-100 text-green-800 border-green-200';
      case 'acknowledge_report': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'view_report': return 'bg-slate-100 text-slate-800 border-slate-200';
      default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-sm font-bold text-slate-800">ประวัติการใช้งานระบบ ({sortedLogs.length})</h2>
      </div>

      <div className="overflow-x-auto rounded border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-xs">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left font-bold text-slate-600">วัน/เวลา</th>
              <th className="px-4 py-3 text-left font-bold text-slate-600">ผู้ใช้งาน</th>
              <th className="px-4 py-3 text-left font-bold text-slate-600">การกระทำ</th>
              <th className="px-4 py-3 text-left font-bold text-slate-600">รายละเอียด</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {sortedLogs.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-500">ไม่มีข้อมูลประวัติ</td>
              </tr>
            ) : sortedLogs.map((log) => {
              const user = users.find(u => u.id === log.userId);
              return (
                <tr key={log.id} className="hover:bg-teal-50/30 transition-colors">
                  <td className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleString('th-TH')}
                  </td>
                  <td className="px-4 py-3 text-slate-800 font-medium">
                    {user ? user.displayName : log.userId}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border uppercase ${getActionColor(log.action)}`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600 border-l border-slate-100">
                    {log.details}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
