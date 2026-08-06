import { Link } from 'react-router-dom';
import Layout from '../../components/Layout';

export default function TeacherLanding() {
  return (
    <Layout title="Teacher Portal" backTo="/">
      <div className="glass-card max-w-md mx-auto text-center space-y-6">
        <p className="text-slate-400">Login to access attendance tools.</p>
        <Link to="/teacher/login" className="btn-primary block text-center">
          Teacher Login
        </Link>
      </div>
    </Layout>
  );
}
