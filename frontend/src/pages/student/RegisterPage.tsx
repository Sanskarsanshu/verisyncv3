import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Layout from '../../components/Layout';
import api, { setRegistrationToken } from '../../lib/api';

const schema = z
  .object({
    fullName: z.string().min(2, 'Full name is required'),
    rollNumber: z.string().min(1, 'Roll number is required'),
    email: z.string().email('Valid email required'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
    semester: z.string().min(1, 'Semester is required').max(20),
    section: z.string().min(1, 'Section is required').max(10),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords must match',
    path: ['confirmPassword'],
  });

type FormData = z.infer<typeof schema>;

export default function RegisterPage() {
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    try {
      const res = await api.post('/auth/register', data);
      setRegistrationToken(res.data.registrationToken);
      toast.success('Account details validated! Proceed to face enrollment.');
      navigate('/student/register/face');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Registration failed';
      toast.error(msg);
    }
  };

  return (
    <Layout title="Register — Step 1: Create Account" backTo="/student">
      <form onSubmit={handleSubmit(onSubmit)} className="glass-card max-w-md mx-auto space-y-4">
        <div>
          <label className="block text-sm text-slate-400 mb-1">Full Name</label>
          <input className="input-field" {...register('fullName')} />
          {errors.fullName && <p className="text-red-400 text-xs mt-1">{errors.fullName.message}</p>}
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">Roll Number</label>
          <input className="input-field" {...register('rollNumber')} />
          {errors.rollNumber && <p className="text-red-400 text-xs mt-1">{errors.rollNumber.message}</p>}
        </div>
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
        <div>
          <label className="block text-sm text-slate-400 mb-1">Confirm Password</label>
          <input type="password" className="input-field" {...register('confirmPassword')} />
          {errors.confirmPassword && (
            <p className="text-red-400 text-xs mt-1">{errors.confirmPassword.message}</p>
          )}
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">Semester</label>
          <input className="input-field" placeholder="e.g. 5" {...register('semester')} />
          {errors.semester && <p className="text-red-400 text-xs mt-1">{errors.semester.message}</p>}
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">Section</label>
          <input className="input-field" placeholder="e.g. A" {...register('section')} />
          {errors.section && <p className="text-red-400 text-xs mt-1">{errors.section.message}</p>}
        </div>
        <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
          {isSubmitting ? 'Validating...' : 'Continue to Face Enrollment →'}
        </button>
      </form>
    </Layout>
  );
}
