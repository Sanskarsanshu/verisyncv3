import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import ProtectedRoute from './components/ProtectedRoute';
import HomePage from './pages/HomePage';
import StudentLanding from './pages/student/StudentLanding';
import RegisterPage from './pages/student/RegisterPage';
import FaceEnrollmentPage from './pages/student/FaceEnrollmentPage';
import LoginPage from './pages/student/LoginPage';
import StudentDashboard from './pages/student/StudentDashboard';
import TeacherLanding from './pages/teacher/TeacherLanding';
import TeacherLoginPage from './pages/teacher/TeacherLoginPage';
import TeacherDashboard from './pages/teacher/TeacherDashboard';
import FaceAttendancePage from './pages/teacher/FaceAttendancePage';
import QrAttendancePage from './pages/teacher/QrAttendancePage';
import LiveAttendancePage from './pages/teacher/LiveAttendancePage';
import AttendancePage from './pages/student/AttendancePage';

export default function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1e293b',
            color: '#f1f5f9',
            border: '1px solid #334155',
          },
        }}
      />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/student" element={<StudentLanding />} />
        <Route path="/student/register" element={<RegisterPage />} />
        <Route path="/student/register/face" element={<FaceEnrollmentPage />} />
        <Route
          path="/student/enroll"
          element={
            <ProtectedRoute role="student">
              <FaceEnrollmentPage />
            </ProtectedRoute>
          }
        />
        <Route path="/student/login" element={<LoginPage />} />
        <Route
          path="/student/dashboard"
          element={
            <ProtectedRoute role="student">
              <StudentDashboard />
            </ProtectedRoute>
          }
        />
        <Route path="/teacher" element={<TeacherLanding />} />
        <Route path="/teacher/login" element={<TeacherLoginPage />} />
        <Route path="/attendance" element={<AttendancePage />} />
        <Route
          path="/teacher/dashboard"
          element={
            <ProtectedRoute role="teacher">
              <TeacherDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/teacher/face-attendance"
          element={
            <ProtectedRoute role="teacher">
              <FaceAttendancePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/teacher/qr-attendance"
          element={
            <ProtectedRoute role="teacher">
              <QrAttendancePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/teacher/live-attendance"
          element={
            <ProtectedRoute role="teacher">
              <LiveAttendancePage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
