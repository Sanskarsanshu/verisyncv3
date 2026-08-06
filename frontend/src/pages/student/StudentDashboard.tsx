import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Layout from '../../components/Layout';
import api, { logout, fetchCurrentUser } from '../../lib/api';

interface Profile {
  fullName: string;
  rollNumber: string;
  email: string;
  faceVerified: boolean;
  totalClassesAttended: number;
  attendancePercentage: number;
  qrCodeDataUrl: string | null;
  recentAttendance: Array<{
    id: string;
    date: string;
    time: string;
    method: string;
    confidence: number | null;
  }>;
}

export default function StudentDashboard() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCurrentUser().then((user) => {
      if (!user) {
        navigate('/student/login', { replace: true });
        return;
      }
      api
        .get('/student/profile')
        .then((res) => setProfile(res.data))
        .catch(() => {
          toast.error('Failed to load profile');
          navigate('/student/login');
        })
        .finally(() => setLoading(false));
    });
  }, [navigate]);

  const handleLogout = async () => {
    await logout();
    navigate('/student');
  };

  if (loading) {
    return (
      <Layout title="Student Dashboard">
        <div className="text-center text-slate-400">Loading dashboard...</div>
      </Layout>
    );
  }

  if (!profile) return null;

  return (
    <Layout title="Student Dashboard">
      <div className="space-y-6">
        <div className="flex justify-end gap-3">
          <button
            onClick={() => navigate('/student/enroll?mode=re-enroll')}
            className="btn-secondary text-sm"
          >
            Re-enroll Face
          </button>
          <button onClick={handleLogout} className="btn-secondary text-sm">
            Logout
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="glass-card space-y-3">
            <h2 className="text-lg font-semibold text-indigo-300">Profile</h2>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-slate-400">Name</span>
              <span>{profile.fullName}</span>
              <span className="text-slate-400">Roll Number</span>
              <span>{profile.rollNumber}</span>
              <span className="text-slate-400">Email</span>
              <span>{profile.email}</span>
              <span className="text-slate-400">Face Verification</span>
              <span>{profile.faceVerified ? 'Verified ✅' : 'Incomplete ⚠'}</span>
            </div>
          </div>

          <div className="glass-card space-y-3">
            <h2 className="text-lg font-semibold text-indigo-300">Attendance Stats</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-slate-900/50 rounded-xl">
                <div className="text-3xl font-bold text-green-400">{profile.totalClassesAttended}</div>
                <div className="text-xs text-slate-400">Classes Attended</div>
              </div>
              <div className="text-center p-4 bg-slate-900/50 rounded-xl">
                <div className="text-3xl font-bold text-indigo-400">{profile.attendancePercentage}%</div>
                <div className="text-xs text-slate-400">Attendance Rate</div>
              </div>
            </div>
          </div>
        </div>

        {profile.qrCodeDataUrl && (
          <div className="glass-card text-center">
            <h2 className="text-lg font-semibold text-indigo-300 mb-4">Your QR Code</h2>
            <div className="inline-block bg-white p-4 rounded-lg">
              <img src={profile.qrCodeDataUrl} alt="Student QR Code" className="w-72 h-72 rounded" />
            </div>
            <p className="text-xs text-slate-400 mt-3">
              Show this QR code for QR-based attendance. Increase screen brightness for faster
              scanning.
            </p>
          </div>
        )}

        <div className="glass-card">
          <h2 className="text-lg font-semibold text-indigo-300 mb-4">Recent Attendance History</h2>
          {profile.recentAttendance.length === 0 ? (
            <p className="text-slate-400 text-sm">No attendance records yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-700">
                    <th className="text-left py-2">Date</th>
                    <th className="text-left py-2">Time</th>
                    <th className="text-left py-2">Method</th>
                    <th className="text-left py-2">Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {profile.recentAttendance.map((a) => (
                    <tr key={a.id} className="border-b border-slate-800">
                      <td className="py-2">{new Date(a.date).toLocaleDateString()}</td>
                      <td className="py-2">{new Date(a.time).toLocaleTimeString()}</td>
                      <td className="py-2">{a.method}</td>
                      <td className="py-2">
                        {a.confidence ? `${(a.confidence * 100).toFixed(1)}%` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
