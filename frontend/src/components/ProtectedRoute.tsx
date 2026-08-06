import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { fetchCurrentUser, type CurrentUser } from '../lib/api';

interface Props {
  children: React.ReactNode;
  role: 'student' | 'teacher';
}

export default function ProtectedRoute({ children, role }: Props) {
  const location = useLocation();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;
    fetchCurrentUser().then((u) => {
      if (!active) return;
      setUser(u);
      setChecking(false);
    });
    return () => {
      active = false;
    };
  }, []);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400">
        Checking session...
      </div>
    );
  }

  if (!user) {
    const target = role === 'student' ? '/student/login' : '/teacher/login';
    const redirect = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`${target}?redirect=${redirect}`} replace />;
  }

  if (user.role !== role) {
    return <Navigate to={role === 'student' ? '/student' : '/teacher'} replace />;
  }

  return <>{children}</>;
}
