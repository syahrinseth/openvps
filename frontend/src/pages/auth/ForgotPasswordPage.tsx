import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Server, ArrowLeft } from 'lucide-react';
import api from '@/lib/api';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';

const schema = z.object({
  email: z.string().email('Invalid email address'),
});

type FormData = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    setError('');
    try {
      await api.post('/auth/forgot-password', { email: data.email });
      setSubmitted(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Server className="w-10 h-10 text-blue-600" />
            <span className="text-3xl font-bold text-gray-900">OpenVPS</span>
          </div>
          <p className="text-gray-500">Reset your password</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          {submitted ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Check your inbox</h2>
              <p className="text-sm text-gray-500 mb-6">
                If that email address is registered, a password reset link has been sent.
                The link expires in 60 minutes.
              </p>
              <Link to="/login" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                Back to sign in
              </Link>
            </div>
          ) : (
            <>
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                  {error}
                </div>
              )}

              <p className="text-sm text-gray-500 mb-4">
                Enter the email address for your account and we'll send you a reset link.
              </p>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <Input
                  id="email"
                  label="Email"
                  type="email"
                  placeholder="you@example.com"
                  error={errors.email?.message}
                  {...register('email')}
                />
                <Button type="submit" isLoading={isLoading} className="w-full">
                  Send reset link
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
