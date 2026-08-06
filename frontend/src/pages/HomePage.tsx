import { Link } from 'react-router-dom';
import Layout from '../components/Layout';

export default function HomePage() {
  return (
    <Layout title="AI Face Recognition Attendance System">
      <div className="grid md:grid-cols-2 gap-6">
        <Link to="/student" className="glass-card group hover:border-indigo-500/50 transition-all duration-300 text-center p-10">
          <div className="text-5xl mb-4">🎓</div>
          <h2 className="text-2xl font-bold mb-2 group-hover:text-indigo-300 transition-colors">Student Portal</h2>
          <p className="text-slate-400">Register, login, and view your attendance dashboard</p>
        </Link>
        <Link to="/teacher" className="glass-card group hover:border-purple-500/50 transition-all duration-300 text-center p-10">
          <div className="text-5xl mb-4">👨‍🏫</div>
          <h2 className="text-2xl font-bold mb-2 group-hover:text-purple-300 transition-colors">Teacher Portal</h2>
          <p className="text-slate-400">Take attendance using face recognition or QR codes</p>
        </Link>
      </div>
    </Layout>
  );
}
