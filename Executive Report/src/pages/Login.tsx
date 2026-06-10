import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { Mail, Lock, X, Info } from 'lucide-react';
import { User } from '../types';
import mophLogo from '../../MOPH Logo.png';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false); // controls welcome overlay
  const [welcomeName, setWelcomeName] = useState('');
  const navigate = useNavigate();
  const { currentUser, login } = useAppStore();

  useEffect(() => {
    if (currentUser) {
      navigate('/', { replace: true });
    }
  }, [currentUser, navigate]);

  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!email || !password) {
      setError('กรุณากรอกอีเมลและรหัสผ่าน');
      return;
    }

    setIsLoading(true);
    try {
      const res = await login(email, password);
      if (res.success) {
        // Read the display name from store state after successful login
        const loggedInUser = useAppStore.getState().currentUser;
        setWelcomeName(loggedInUser?.displayName || '');
        setLoginSuccess(true);
        setTimeout(() => {
          navigate('/', { replace: true });
        }, 1500);
      } else {
        setError(res.error || 'อีเมลหรือรหัสผ่านไม่ถูกต้อง');
        setIsLoading(false);
      }
    } catch (err) {
      setError('เกิดข้อผิดพลาดในการเชื่อมต่อ');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F0F7F4] flex flex-col justify-center py-12 sm:px-6 lg:px-8 border-t-8 border-[#009688]">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="bg-white p-3 rounded-2xl shadow-lg border border-teal-100">
            <img src={mophLogo} 
                 alt="MOPH Logo" 
                 className="h-20 w-auto" 
            />
          </div>
        </div>
        <h2 className="mt-6 text-center text-2xl font-bold text-[#009688]">
          Executive Report
        </h2>
        <p className="mt-2 text-center text-xs font-bold text-slate-500 uppercase tracking-widest">
          โรงพยาบาลสารภี Saraphi Hospital
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-sm sm:rounded-xl sm:px-10 border border-slate-200">
          <form className="space-y-6" onSubmit={handleLogin}>
            
            {error && (
              <div className="bg-red-50 text-red-600 text-sm font-medium p-3 rounded border border-red-200 text-center">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-bold text-slate-700 mb-1">
                อีเมลผู้ใช้งาน (Email)
              </label>
              <div className="relative mt-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@moph.go.th"
                  className="appearance-none block w-full pl-10 pr-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-500 sm:text-sm font-medium text-slate-700 bg-slate-50"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-bold text-slate-700 mb-1">
                รหัสผ่าน (Password)
              </label>
              <div className="relative mt-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="appearance-none block w-full pl-10 pr-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-500 sm:text-sm font-medium text-slate-700 bg-slate-50"
                />
              </div>
            </div>

            <div className="flex items-center justify-end mt-2">
              <div className="text-xs">
                <button
                  type="button"
                  onClick={() => setShowForgotPasswordModal(true)}
                  className="font-medium text-teal-600 hover:text-teal-500 bg-transparent border-none p-0 cursor-pointer outline-none hover:underline"
                >
                  ลืมรหัสผ่าน?
                </button>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center items-center py-2 px-4 shadow-lg shadow-teal-200 text-sm font-bold text-white rounded bg-[#009688] hover:opacity-90 focus:outline-none transition-all disabled:opacity-80 disabled:cursor-wait"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    กำลังเข้าสู่ระบบ...
                  </>
                ) : (
                  'เข้าสู่ระบบ (LOGIN)'
                )}
              </button>
            </div>
            
            {/* Test credentials helper removed for production */}
          </form>
        </div>
      </div>

      {/* Welcome Overlay — shown after successful login */}
      {loginSuccess && (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm transition-all duration-300">
          <svg className="animate-spin h-10 w-10 text-teal-600 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-teal-700 font-bold text-xl animate-pulse">
            สวัสดี, {welcomeName}
          </p>
          <p className="text-teal-600/70 text-sm mt-3 font-medium">
            กำลังพาท่านเข้าสู่ระบบ...
          </p>
        </div>
      )}
      {/* Forgot Password Modal */}
      {showForgotPasswordModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-300"
            onClick={() => setShowForgotPasswordModal(false)}
          />

          {/* Modal Content Card */}
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 overflow-hidden border border-slate-100 transform transition-all scale-100 animate-in fade-in zoom-in-95 duration-200 z-[110]">
            <button 
              type="button" 
              onClick={() => setShowForgotPasswordModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg hover:bg-slate-50 cursor-pointer outline-none"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex flex-col items-center text-center mt-2 text-slate-700">
              <div className="p-3 bg-teal-50 rounded-full mb-4">
                <Info className="w-8 h-8 text-[#009688]" />
              </div>
              
              <h3 className="text-base font-bold text-slate-800 mb-2 leading-tight">
                แจ้งเตือนการลืมรหัสผ่าน
              </h3>
              
              <p className="text-xs text-slate-500 font-medium mb-6 leading-relaxed">
                โปรดติดต่อผู้ดูแลระบบที่ห้อง IT หรือส่งอีเมลมาที่ <strong className="text-[#009688]">srp-it@moph.go.th</strong> เพื่อเปลี่ยนรหัสผ่านของคุณ
              </p>

              <button
                type="button"
                onClick={() => setShowForgotPasswordModal(false)}
                className="w-full py-2 px-4 shadow-sm text-xs font-bold text-white rounded bg-[#009688] hover:opacity-90 transition-opacity cursor-pointer outline-none shadow-teal-100"
              >
                ตกลง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
