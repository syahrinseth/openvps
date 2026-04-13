import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Server, ArrowLeft } from 'lucide-react';
import api from '@/lib/api';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';

const schema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters'),
    password_confirmation: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.password_confirmation, {
    message: 'Passwords do not match',
    path: ['password_confirmation'],
  });

type FormData = z.infer<typeof schema>;

export default function ResetPasswordPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const token = searchParams.get('token') ?? '';
  const email = searchParams.get('email') ?? '';

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    if (!token || !email) {
      setError('Invalid or missing reset link. Please request a new one.');
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      await api.post('/auth/reset-password', {
        token,
        email,
        password: data.password,
        password_confirmation: data.password_confirmation,
      });
      navigate('/login', {
        state: { message: 'Password reset successfully. Please sign in with your new password.' },
      });
    } catch (err: any) {
      if (err.response?.data?.errors?.token) {
        setError('This reset link is invalid or has expired. Please request a new one.');
      } else {
        setError(err.response?.data?.message || 'Failed to reset password. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const linkMissing = !token || !email;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Server className="w-10 h-10 text-blue-600" />
            <span className="text-3xl font-bold text-gray-900">OpenVPS</span>
          </div>
          <p className="text-gray-500">Choose a new password</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          {linkMissing ? (
            <div className="text-center py-4">
              <p className="text-sm text-red-600 mb-4">
                This reset link is invalid or incomplete. Please request a new one.
              </p>
              <Link
                to="/forgot-password"
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                Request a new reset link
              </Link>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                  {error}
                  {error.includes('invalid or has expired') && (
                    <span>
                      {' '}
                      <Link to="/forgot-password" className="underline font-medium">
                        Get a new link
                      </Link>
                    </span>
                  )}
                </div>
              )}

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <Input
                  id="password"
                  label="New Password"
                  type="password"
                  placeholder="At least 8 characters"
                  error={errors.password?.message}
                  {...register('password')}
                />
                <Input
                  id="password_confirmation"
                  label="Confirm New Password"
                  type="password"
                  placeholder="Confirm your new password"
                  error={errors.password_confirmation?.message}
                  {...register('password_confirmation')}
                />
                <Button type="submit" isLoading={isLoading} className="w-full">
                  Reset password
                </Button>
              </form>

              <p className="text-sm text-gray-500 text-center mt-4">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back to sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
