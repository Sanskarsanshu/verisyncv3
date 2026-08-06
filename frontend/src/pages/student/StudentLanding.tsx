import { Link } from 'react-router-dom';
import Layout from '../../components/Layout';

export default function StudentLanding() {
  return (
    <Layout title="Student Portal" backTo="/">
      <div className="glass-card max-w-md mx-auto text-center space-y-6">
        <p className="text-slate-400">Welcome! Choose an option to continue.</p>
        <div className="flex flex-col gap-4">
          <Link to="/student/login" className="btn-primary block text-center">
            Login
          </Link>
          <Link to="/student/register" className="btn-secondary block text-center">
            Register
          </Link>
        </div>
      </div>
    </Layout>
  );
}
