import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import Layout from '../../components/Layout';
import api, { fetchCurrentUser, logout, type CurrentUser } from '../../lib/api';

interface SessionInfo {
  sessionCode: string;
  subjectName: string | null;
  subjectCode: string | null;
  semester: string | null;
  section: string | null;
  classroom: string | null;
  teacherName: string | null;
  status: string;
  expiryTime: string | null;
}

interface StatusResult {
  valid: boolean;
  reason?: 'SESSION_NOT_FOUND' | 'TOKEN_INVALID' | 'SESSION_INACTIVE';
  alreadyMarked?: boolean;
  session?: SessionInfo;
}

export default function AttendancePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionCode = searchParams.get('session') ?? '';
  const token = searchParams.get('token') ?? '';

  const [user, setUser] = useState<CurrentUser | null>(null);
  const [checkingUser, setCheckingUser] = useState(true);
  const [status, setStatus] = useState<StatusResult | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [marking, setMarking] = useState(false);
  const [marked, setMarked] = useState<{
    fullName: string;
    rollNumber: string;
    markedAt: string;
  } | null>(null);
  const [markError, setMarkError] = useState<string | null>(null);

  useEffect(() => {
    fetchCurrentUser().then((u) => {
      setUser(u);
      setCheckingUser(false);
      if (!u) {
        const redirect = encodeURIComponent(`/attendance?session=${sessionCode}&token=${token}`);
        navigate(`/student/login?redirect=${redirect}`, { replace: true });
        return;
      }
      if (u.role !== 'student') {
        setMarkError('Attendance QR codes can only be used by students. Please switch to a student account.');
      }
    });
  }, [navigate, sessionCode, token]);

  useEffect(() => {
    if (checkingUser || !user || user.role !== 'student' || !sessionCode || !token) {
      setCheckingStatus(false);
      return;
    }
    api
      .get<StatusResult>('/attendance/dynamic/status', {
        params: { sessionCode, token },
      })
      .then((res) => setStatus(res.data))
      .catch(() => {
        toast.error('Failed to check attendance status');
        setStatus(null);
      })
      .finally(() => setCheckingStatus(false));
  }, [checkingUser, user, sessionCode, token]);

  const handleMark = async () => {
    if (!sessionCode || !token) return;
    setMarking(true);
    setMarkError(null);
    try {
      const res = await api.post<{
        matched: boolean;
        alreadyMarked?: boolean;
        message?: string;
        reason?: string;
        student?: { fullName: string; rollNumber: string };
        markedAt?: string;
      }>('/attendance/dynamic', { sessionCode, token });
      if (res.data.matched && res.data.student) {
        setMarked({
          fullName: res.data.student.fullName,
          rollNumber: res.data.student.rollNumber,
          markedAt: res.data.markedAt ?? new Date().toISOString(),
        });
        toast.success(res.data.message ?? 'Attendance Marked Successfully');
      } else {
        const msg = res.data.message ?? 'Could not mark attendance';
        setMarkError(msg);
        if (res.data.reason === 'TOKEN_EXPIRED' || res.data.reason === 'SESSION_INACTIVE') {
          setStatus({ valid: false, reason: 'TOKEN_INVALID' });
        }
        toast.error(msg);
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setMarkError(msg ?? 'Failed to mark attendance');
      toast.error(msg ?? 'Failed to mark attendance');
    } finally {
      setMarking(false);
    }
  };

  const handleSwitchAccount = async () => {
    await logout();
    const redirect = encodeURIComponent(`/attendance?session=${sessionCode}&token=${token}`);
    navigate(`/student/login?redirect=${redirect}`);
  };

  const renderBody = () => {
    if (checkingStatus) {
      return <div className="text-center text-slate-400 py-20">Checking attendance...</div>;
    }

    if (user && user.role !== 'student' && markError) {
      return (
        <div className="glass-card max-w-md mx-auto text-center py-16">
          <div className="text-5xl mb-4">🔒</div>
          <h2 className="text-xl font-bold text-red-300">Attendance Requires a Student Account</h2>
          <p className="text-slate-400 text-sm mt-3">{markError}</p>
          <div className="flex gap-3 mt-8 justify-center">
            <button onClick={handleSwitchAccount} className="btn-secondary text-sm">
              Switch Account
            </button>
            <button onClick={() => navigate('/teacher/dashboard')} className="btn-primary">
              Go to Teacher Dashboard
            </button>
          </div>
        </div>
      );
    }

    if (!sessionCode || !token) {
      return (
        <div className="glass-card max-w-md mx-auto text-center py-16">
          <div className="text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-amber-300">Invalid Attendance Link</h2>
          <p className="text-slate-400 text-sm mt-3">
            This attendance link is missing required information. Please scan the QR code shown by
            your teacher again.
          </p>
        </div>
      );
    }

    if (marked) {
      return (
        <div className="glass-card max-w-md mx-auto text-center py-16">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-2xl font-bold text-green-400">Attendance Marked!</h2>
          <p className="mt-3 text-slate-200 font-semibold">{marked.fullName}</p>
          <p className="text-sm text-slate-400">{marked.rollNumber}</p>
          <p className="text-xs text-slate-500 mt-2">
            {new Date(marked.markedAt).toLocaleTimeString()} ·{' '}
            {new Date(marked.markedAt).toLocaleDateString()}
          </p>
          <button onClick={() => navigate('/student/dashboard')} className="btn-primary mt-8">
            Go to Dashboard
          </button>
        </div>
      );
    }

    if (!status?.valid) {
      return (
        <div className="glass-card max-w-md mx-auto text-center py-16">
          <div className="text-5xl mb-4">🕒</div>
          <h2 className="text-xl font-bold text-amber-300">QR Code Expired</h2>
          <p className="text-slate-400 text-sm mt-3">
            This QR code is no longer valid. Ask your teacher to refresh it, then scan again.
          </p>
          <button onClick={() => navigate('/student/dashboard')} className="btn-primary mt-8">
            Go to Dashboard
          </button>
        </div>
      );
    }

    const info = status.session!;
    const sectionMismatch =
      !!user?.section && !!info.section && user.section.toUpperCase() !== info.section.toUpperCase();

    return (
      <div className="glass-card max-w-md mx-auto space-y-5">
        <div className="text-center">
          <div className="text-5xl mb-2">📘</div>
          <h2 className="text-xl font-bold text-emerald-300">
            {info.subjectName} {info.subjectCode ? `(${info.subjectCode})` : ''}
          </h2>
          <p className="text-sm text-slate-400">
            {info.teacherName ? `${info.teacherName} · ` : ''}Sem {info.semester} · Section{' '}
            {info.section}
            {info.classroom ? ` · ${info.classroom}` : ''}
          </p>
          {info.expiryTime && (
            <p className="text-xs text-slate-500 mt-1">
              Session active until {new Date(info.expiryTime).toLocaleTimeString()}
            </p>
          )}
        </div>

        {status.alreadyMarked ? (
          <div className="text-center py-4">
            <div className="text-4xl mb-2">✅</div>
            <p className="text-green-300 font-semibold">You're already marked present</p>
            <button onClick={() => navigate('/student/dashboard')} className="btn-primary mt-6 w-full">
              Go to Dashboard
            </button>
          </div>
        ) : (
          <>
            {sectionMismatch && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-sm text-amber-200">
                This session is for section {info.section}, but you are enrolled in section{' '}
                {user?.section}. Continue only if your teacher says this is your class.
              </div>
            )}
            {markError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-300">
                {markError}
              </div>
            )}
            <div className="text-center text-sm text-slate-400">
              Checking in as{' '}
              <span className="font-semibold text-slate-200">{user?.fullName}</span>
            </div>
            <button
              onClick={handleMark}
              disabled={marking}
              className="btn-primary w-full"
            >
              {marking ? 'Marking...' : 'Mark Attendance'}
            </button>
            <button
              onClick={handleSwitchAccount}
              className="btn-secondary w-full text-sm"
              disabled={marking}
            >
              Switch Account
            </button>
          </>
        )}
      </div>
    );
  };

  return (
    <Layout title="Dynamic QR Attendance">
      {checkingUser ? (
        <div className="text-center text-slate-400 py-20">Checking session...</div>
      ) : (
        renderBody()
      )}
    </Layout>
  );
}
