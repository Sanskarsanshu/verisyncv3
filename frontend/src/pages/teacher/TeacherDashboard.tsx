import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Layout from '../../components/Layout';
import api, { logout, fetchCurrentUser } from '../../lib/api';

interface DashboardData {
  totalStudents: number;
  todayAttendanceCount: number;
  todayAttendance: Array<{
    id: string;
    studentName: string;
    rollNumber: string;
    method: string;
    markedAt: string;
    confidence: number | null;
  }>;
}

export default function TeacherDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    fetchCurrentUser().then((user) => {
      if (!user) {
        navigate('/teacher/login', { replace: true });
        return;
      }
      api
        .get('/teacher/dashboard')
        .then((res) => setData(res.data))
        .catch(() => {
          toast.error('Failed to load dashboard');
          navigate('/teacher/login');
        });
    });
  }, [navigate]);

  const handleLogout = async () => {
    await logout();
    navigate('/teacher');
  };

  return (
    <Layout title="Teacher Dashboard">
      <div className="space-y-6">
        <div className="flex justify-end">
          <button onClick={handleLogout} className="btn-secondary text-sm">Logout</button>
        </div>

        {data && (
          <div className="grid md:grid-cols-2 gap-4">
            <div className="glass-card text-center p-6">
              <div className="text-3xl font-bold text-indigo-400">{data.totalStudents}</div>
              <div className="text-sm text-slate-400">Registered Students</div>
            </div>
            <div className="glass-card text-center p-6">
              <div className="text-3xl font-bold text-green-400">{data.todayAttendanceCount}</div>
              <div className="text-sm text-slate-400">Today's Attendance</div>
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          <Link to="/teacher/face-attendance" className="glass-card group hover:border-indigo-500/50 transition-all p-8 text-center">
            <div className="text-4xl mb-3">📷</div>
            <h2 className="text-xl font-bold group-hover:text-indigo-300">Face Recognition Attendance</h2>
            <p className="text-slate-400 text-sm mt-2">Automatically mark attendance using AI face recognition</p>
          </Link>
          <Link to="/teacher/qr-attendance" className="glass-card group hover:border-purple-500/50 transition-all p-8 text-center">
            <div className="text-4xl mb-3">📱</div>
            <h2 className="text-xl font-bold group-hover:text-purple-300">QR Code Attendance</h2>
            <p className="text-slate-400 text-sm mt-2">Scan student QR codes to mark attendance</p>
          </Link>
          <Link to="/teacher/live-attendance" className="glass-card group hover:border-emerald-500/50 transition-all p-8 text-center">
            <div className="text-4xl mb-3">⚡</div>
            <h2 className="text-xl font-bold group-hover:text-emerald-300">Dynamic QR Attendance</h2>
            <p className="text-slate-400 text-sm mt-2">Secure rotating QR code students scan to check in</p>
          </Link>
        </div>

        {data && data.todayAttendance.length > 0 && (
          <div className="glass-card">
            <h2 className="text-lg font-semibold text-indigo-300 mb-4">Today's Attendance</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-700">
                    <th className="text-left py-2">Name</th>
                    <th className="text-left py-2">Roll No</th>
                    <th className="text-left py-2">Method</th>
                    <th className="text-left py-2">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {data.todayAttendance.map((a) => (
                    <tr key={a.id} className="border-b border-slate-800">
                      <td className="py-2">{a.studentName}</td>
                      <td className="py-2">{a.rollNumber}</td>
                      <td className="py-2">{a.method}</td>
                      <td className="py-2">{new Date(a.markedAt).toLocaleTimeString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
