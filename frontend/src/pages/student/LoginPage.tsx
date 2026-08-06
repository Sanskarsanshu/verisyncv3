import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import Layout from '../../components/Layout';
import api from '../../lib/api';

const schema = z.object({
  email: z.string().email('Valid email required'),
  password: z.string().min(1, 'Password is required'),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
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
      const res = await api.post('/auth/login', data);
      toast.success(`Welcome, ${res.data.user.fullName}!`);
      navigate(redirect || '/student/dashboard', { replace: true });
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      const msg = error.response?.data?.error ?? 'Login failed';
      if (msg.includes('Face verification')) {
        toast.error('⚠ Face verification is incomplete');
      } else {
        toast.error('❌ Invalid email or password');
      }
    }
  };

  return (
    <Layout title="Student Login" backTo="/student">
      <form onSubmit={handleSubmit(onSubmit)} className="glass-card max-w-md mx-auto space-y-4">
        <div>
          <label className="block text-sm text-slate-400 mb-1">Email Address</label>
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
        {redirect && (
          <p className="text-xs text-slate-500 text-center">
            You'll be returned to your attendance page after login.
          </p>
        )}
      </form>
    </Layout>
  );
}
