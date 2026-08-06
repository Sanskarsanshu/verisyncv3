import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import Layout from '../../components/Layout';
import api from '../../lib/api';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

type FormData = z.infer<typeof schema>;

export default function TeacherLoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get('redirect');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    try {
      const res = await api.post('/auth/teacher/login', data);
      toast.success(`Welcome, ${res.data.user.fullName}!`);
      navigate(redirect || '/teacher/dashboard', { replace: true });
    } catch {
      toast.error('❌ Invalid email or password');
    }
  };

  return (
    <Layout title="Teacher Login" backTo="/teacher">
      <form onSubmit={handleSubmit(onSubmit)} className="glass-card max-w-md mx-auto space-y-4">
        <div>
          <label className="block text-sm text-slate-400 mb-1">Email</label>
          <input type="email" className="input-field" {...register('email')} />
          {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">Password</label>
          <input type="password" className="input-field" {...register('password')} />
          {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>}
        </div>
        <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
          {isSubmitting ? 'Logging in...' : 'Login'}
        </button>
      </form>
    </Layout>
  );
}
