import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Layout from '../../components/Layout';
import api from '../../lib/api';

interface Subject {
  id: string;
  code: string;
  name: string;
}

interface SessionInfo {
  id: string;
  sessionCode: string;
  subjectName: string | null;
  subjectCode: string | null;
  semester: string | null;
  section: string | null;
  classroom: string | null;
  startTime: string | null;
  expiryTime: string | null;
  status: string;
  isActive: boolean;
}

interface QrInfo {
  token: string;
  qrUrl: string;
  qrDataUrl: string;
  expiresAt: string;
}

interface CurrentSessionResponse {
  session: SessionInfo;
  present: number;
  qr: QrInfo | null;
}

interface AttendanceRow {
  id: string;
  studentName: string;
  rollNumber: string;
  section: string | null;
  method: string;
  markedAt: string;
}

interface SessionDetailResponse {
  session: SessionInfo;
  present: number;
  attendance: AttendanceRow[];
  qr: QrInfo | null;
}

export default function LiveAttendancePage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [qr, setQr] = useState<QrInfo | null>(null);
  const [present, setPresent] = useState(0);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  // Create-session form state
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [form, setForm] = useState({
    subjectId: '',
    semester: '',
    section: '',
    classroom: '',
    durationMinutes: 15,
  });
  const [creating, setCreating] = useState(false);

  const pollTimer = useRef<number>(0);
  const countdownTimer = useRef<number>(0);
  const stoppedRef = useRef(false);

  const loadSession = useCallback(async () => {
    try {
      const res = await api.get<CurrentSessionResponse>('/session/current');
      if (res.data.session) {
        setSession(res.data.session);
        setQr(res.data.qr);
        setPresent(res.data.present);
        if (res.data.qr) {
          setSecondsLeft(
            Math.max(0, Math.floor((new Date(res.data.qr.expiresAt).getTime() - Date.now()) / 1000))
          );
        }
      }
    } catch {
      // Ignore transient errors while polling.
    }
  }, []);

  const loadDetail = useCallback(async (sessionCode: string) => {
    try {
      const res = await api.get<SessionDetailResponse>(`/session/${sessionCode}`);
      setPresent(res.data.present);
      setAttendance(res.data.attendance);
    } catch {
      // Ignore transient errors while polling.
    }
  }, []);

  useEffect(() => {
    loadSession().finally(() => setLoading(false));
    return () => {
      clearInterval(pollTimer.current);
      clearInterval(countdownTimer.current);
    };
  }, [loadSession]);

  useEffect(() => {
    if (!session) return;
    pollTimer.current = window.setInterval(() => {
      if (session.status === 'ACTIVE') {
        loadSession();
        loadDetail(session.sessionCode);
      }
    }, 5000);
    return () => clearInterval(pollTimer.current);
  }, [session, loadSession, loadDetail]);

  useEffect(() => {
    if (!qr || !session || session.status !== 'ACTIVE') return;
    countdownTimer.current = window.setInterval(() => {
      const left = Math.floor((new Date(qr.expiresAt).getTime() - Date.now()) / 1000);
      setSecondsLeft(Math.max(0, left));
    }, 1000);
    return () => clearInterval(countdownTimer.current);
  }, [qr, session]);

  // Auto-refresh the QR when it expires.
  useEffect(() => {
    if (secondsLeft === 0 && qr && session?.status === 'ACTIVE' && !refreshing) {
      handleRefresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft]);

  const handleRefresh = async () => {
    if (!session || refreshing) return;
    setRefreshing(true);
    try {
      const res = await api.post<{ session: SessionInfo; qr: QrInfo }>('/session/refresh-qr', {
        sessionCode: session.sessionCode,
      });
      setQr(res.data.qr);
      setSecondsLeft(
        Math.max(0, Math.floor((new Date(res.data.qr.expiresAt).getTime() - Date.now()) / 1000))
      );
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      if (msg === 'Session is not active') {
        toast.error('Session has ended');
        setSession((s) => (s ? { ...s, status: 'ENDED', isActive: false } : s));
      } else {
        toast.error(msg ?? 'Failed to refresh QR');
      }
    } finally {
      setRefreshing(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.subjectId || !form.semester || !form.section) {
      toast.error('Please select a subject and enter semester and section');
      return;
    }
    setCreating(true);
    try {
      const res = await api.post<{ session: SessionInfo; qr: QrInfo }>('/session/create', {
        subjectId: form.subjectId,
        semester: form.semester,
        section: form.section.toUpperCase(),
        classroom: form.classroom,
        durationMinutes: Number(form.durationMinutes),
      });
      setSession(res.data.session);
      setQr(res.data.qr);
      setPresent(0);
      setSecondsLeft(
        Math.max(0, Math.floor((new Date(res.data.qr.expiresAt).getTime() - Date.now()) / 1000))
      );
      toast.success(`Session ${res.data.session.sessionCode} started`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg ?? 'Failed to create session');
    } finally {
      setCreating(false);
    }
  };

  const handleStop = async () => {
    if (!session) return;
    if (!window.confirm('Stop this session? Students will no longer be able to check in.')) return;
    try {
      stoppedRef.current = true;
      await api.post('/session/stop', { sessionCode: session.sessionCode });
      toast.success('Session stopped');
      navigate('/teacher/dashboard');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg ?? 'Failed to stop session');
    }
  };

  useEffect(() => {
    if (!session && !loading) {
      api
        .get<{ subjects: Subject[] }>('/subjects')
        .then((res) => {
          setSubjects(res.data.subjects);
          if (res.data.subjects.length > 0) {
            setForm((f) => ({ ...f, subjectId: f.subjectId || res.data.subjects[0].id }));
          }
        })
        .catch(() => toast.error('Failed to load subjects'));
    }
  }, [session, loading]);

  const active = session?.status === 'ACTIVE';

  return (
    <Layout title="Dynamic QR Attendance" backTo="/teacher/dashboard">
      {loading ? (
        <div className="text-center text-slate-400 py-20">Loading...</div>
      ) : !session ? (
        <form onSubmit={handleCreate} className="glass-card max-w-md mx-auto space-y-4">
          <h2 className="text-lg font-semibold text-emerald-300">Start a New Session</h2>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Subject</label>
            <select
              className="input-field"
              value={form.subjectId}
              onChange={(e) => setForm({ ...form, subjectId: e.target.value })}
            >
              <option value="">Select subject</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} — {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Semester</label>
              <input
                className="input-field"
                placeholder="e.g. 5"
                value={form.semester}
                onChange={(e) => setForm({ ...form, semester: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Section</label>
              <input
                className="input-field"
                placeholder="e.g. A"
                value={form.section}
                onChange={(e) => setForm({ ...form, section: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Classroom</label>
              <input
                className="input-field"
                placeholder="e.g. Room 201"
                value={form.classroom}
                onChange={(e) => setForm({ ...form, classroom: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Duration</label>
              <select
                className="input-field"
                value={form.durationMinutes}
                onChange={(e) => setForm({ ...form, durationMinutes: Number(e.target.value) })}
              >
                {[5, 10, 15, 20, 30, 45, 60].map((m) => (
                  <option key={m} value={m}>
                    {m} minutes
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button type="submit" disabled={creating} className="btn-primary w-full">
            {creating ? 'Starting...' : 'Start Session →'}
          </button>
        </form>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-emerald-300">
                {session.subjectName} {session.subjectCode ? `(${session.subjectCode})` : ''}
              </h2>
              <p className="text-sm text-slate-400">
                Code: <span className="font-mono text-emerald-400">{session.sessionCode}</span> · Sem{' '}
                {session.semester} · Section {session.section}
                {session.classroom ? ` · ${session.classroom}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  active ? 'bg-green-500/20 text-green-300' : 'bg-slate-700 text-slate-300'
                }`}
              >
                {active ? '● LIVE' : session.status}
              </span>
              <button onClick={handleStop} className="btn-danger text-sm">
                Stop Session
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="glass-card text-center">
              <h3 className="text-sm font-semibold text-slate-400 mb-3">Scan This QR</h3>
              {qr ? (
                <>
                  <div className="inline-block bg-white p-3 rounded-lg">
                    <img src={qr.qrDataUrl} alt="Attendance QR" className="w-64 h-64 rounded" />
                  </div>
                  <div className="mt-3 text-sm">
                    <span className="text-slate-400">Rotates in </span>
                    <span className="font-mono text-2xl font-bold text-emerald-400">
                      {secondsLeft}s
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2 mt-2">
                    <div
                      className="bg-emerald-500 h-2 rounded-full transition-all"
                      style={{ width: `${(secondsLeft / 30) * 100}%` }}
                    />
                  </div>
                  <button
                    onClick={handleRefresh}
                    disabled={refreshing || !active}
                    className="btn-secondary text-sm mt-4 w-full"
                  >
                    {refreshing ? 'Refreshing...' : 'Refresh QR Now'}
                  </button>
                </>
              ) : (
                <p className="text-slate-400 text-sm py-10">No QR available.</p>
              )}
            </div>

            <div className="glass-card text-center">
              <h3 className="text-sm font-semibold text-slate-400 mb-3">Present</h3>
              <div className="text-5xl font-bold text-green-400 py-6">{present}</div>
              <p className="text-sm text-slate-400">students checked in</p>
              {active && (
                <p className="text-xs text-slate-500 mt-4">
                  Expires {session.expiryTime ? new Date(session.expiryTime).toLocaleTimeString() : ''}
                </p>
              )}
            </div>

            <div className="glass-card">
              <h3 className="text-sm font-semibold text-slate-400 mb-3">Attendance List</h3>
              {attendance.length === 0 ? (
                <p className="text-slate-500 text-sm py-10 text-center">No check-ins yet.</p>
              ) : (
                <ul className="space-y-2 max-h-80 overflow-y-auto">
                  {attendance.map((a) => (
                    <li
                      key={a.id}
                      className="flex items-center justify-between text-sm bg-slate-900/50 px-3 py-2 rounded-lg"
                    >
                      <span>
                        <span className="font-semibold text-slate-200">{a.studentName}</span>
                        <span className="text-slate-500 ml-2">{a.rollNumber}</span>
                      </span>
                      <span className="text-slate-400 text-xs">
                        {new Date(a.markedAt).toLocaleTimeString()}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
