import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Wifi, Monitor } from 'lucide-react';
import { useCreateServer } from '@/hooks/useServers';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import Header from '@/components/layout/Header';
import Card, { CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';

const serverSchema = z
  .object({
    name: z.string().min(1, 'Name is required'),
    hostname: z.string().min(1, 'Hostname is required'),
    is_local: z.boolean(),
    ip_address: z.string().optional(),
    ssh_port: z.number().min(1).max(65535).optional(),
    ssh_user: z.string().optional(),
    ssh_private_key: z.string().optional(),
    ssh_key_passphrase: z.string().optional(),
    ssh_password: z.string().optional(),
    provider: z.string().min(1, 'Provider is required'),
    notes: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    // SSH fields are required only for remote (non-local) servers
    if (!data.is_local) {
      if (!data.ip_address) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'IP address is required', path: ['ip_address'] });
      } else if (!/^(?:(?:\d{1,3}\.){3}\d{1,3}|[a-fA-F0-9:]+)$/.test(data.ip_address)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid IP address format', path: ['ip_address'] });
      }
      if (!data.ssh_user) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'SSH user is required', path: ['ssh_user'] });
      }
    }
  });

type ServerFormData = z.infer<typeof serverSchema>;

const providerOptions = [
  { value: 'local', label: 'Local (this machine)' },
  { value: 'hetzner', label: 'Hetzner' },
  { value: 'digitalocean', label: 'DigitalOcean' },
  { value: 'linode', label: 'Linode' },
  { value: 'vultr', label: 'Vultr' },
  { value: 'aws', label: 'AWS' },
  { value: 'custom', label: 'Custom / Other' },
];

export default function AddServerPage() {
  const navigate = useNavigate();
  const createServer = useCreateServer();
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'failed' | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<ServerFormData>({
    resolver: zodResolver(serverSchema),
    defaultValues: {
      ssh_port: 22,
      ssh_user: 'root',
      provider: '',
      is_local: false,
    },
  });

  const isLocal = watch('is_local');

  const onSubmit = async (data: ServerFormData) => {
    try {
      await createServer.mutateAsync(data);
      navigate('/servers');
    } catch {
      // Error handled by hook
    }
  };

  const handleTestConnection = async () => {
    const values = getValues();
    if (!values.ip_address || !values.ssh_private_key) {
      toast.error('Please fill in the IP address and SSH key first');
      return;
    }

    setIsTesting(true);
    setTestResult(null);
    try {
      await api.post('/servers/test-connection', {
        hostname: values.hostname,
        ip_address: values.ip_address,
        ssh_port: values.ssh_port,
        ssh_user: values.ssh_user,
        ssh_private_key: values.ssh_private_key,
        ssh_key_passphrase: values.ssh_key_passphrase,
        ssh_password: values.ssh_password,
      });
      setTestResult('success');
      toast.success('Connection successful!');
    } catch {
      setTestResult('failed');
      toast.error('Connection failed. Please check your credentials.');
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <button
          onClick={() => navigate('/servers')}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Servers
        </button>
      </div>

      <Header title="Add Server" description="Connect a new server to your infrastructure" />

      <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl space-y-6">
        {/* Server Type Toggle */}
        <Card>
          <CardHeader title="Server Type" />
          <div className="space-y-3">
            {/* Remote server option */}
            <label
              className={`flex items-start gap-3 rounded-lg border-2 p-4 cursor-pointer transition-colors ${
                !isLocal ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <input
                type="radio"
                className="mt-0.5"
                checked={!isLocal}
                onChange={() => setValue('is_local', false)}
              />
              <div>
                <p className="font-medium text-gray-900 text-sm">Remote VPS</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  A separate server managed over SSH. OpenVPS connects via SSH to deploy apps.
                </p>
              </div>
            </label>

            {/* Local server option */}
            <label
              className={`flex items-start gap-3 rounded-lg border-2 p-4 cursor-pointer transition-colors ${
                isLocal ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <input
                type="radio"
                className="mt-0.5"
                checked={isLocal}
                onChange={() => setValue('is_local', true)}
              />
              <div>
                <div className="flex items-center gap-1.5">
                  <Monitor className="w-3.5 h-3.5 text-blue-600" />
                  <p className="font-medium text-gray-900 text-sm">This machine (local)</p>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  Host websites directly on this OpenVPS server. Apps are routed by Traefik — no SSH needed.
                </p>
              </div>
            </label>
          </div>
        </Card>

        {/* Basic Info */}
        <Card>
          <CardHeader title="Basic Information" />
          <div className="space-y-4">
            <Input
              id="name"
              label="Server Name"
              placeholder="e.g., Production Web Server"
              error={errors.name?.message}
              {...register('name')}
            />
            <div className={`grid gap-4 ${isLocal ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
              <Input
                id="hostname"
                label="Hostname"
                placeholder="e.g., server1.example.com"
                error={errors.hostname?.message}
                {...register('hostname')}
              />
              {!isLocal && (
                <Input
                  id="ip_address"
                  label="IP Address"
                  placeholder="e.g., 192.168.1.100"
                  error={errors.ip_address?.message}
                  {...register('ip_address')}
                />
              )}
            </div>
            <Select
              id="provider"
              label="Provider"
              options={providerOptions}
              error={errors.provider?.message}
              {...register('provider')}
            />
          </div>
        </Card>

        {/* SSH Configuration — only for remote servers */}
        {!isLocal && (
          <Card>
            <CardHeader title="SSH Configuration" />
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  id="ssh_user"
                  label="SSH User"
                  placeholder="root"
                  error={errors.ssh_user?.message}
                  {...register('ssh_user')}
                />
                <Input
                  id="ssh_port"
                  label="SSH Port"
                  type="number"
                  placeholder="22"
                  error={errors.ssh_port?.message}
                  {...register('ssh_port', { valueAsNumber: true })}
                />
              </div>

              {/* SSH Key Auth */}
              <div className="space-y-3 rounded-lg border border-gray-200 p-4">
                <p className="text-sm font-medium text-gray-700">
                  SSH Key Authentication{' '}
                  <span className="text-gray-400 font-normal">(recommended)</span>
                </p>
                <div>
                  <label
                    htmlFor="ssh_private_key"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    SSH Private Key
                  </label>
                  <textarea
                    id="ssh_private_key"
                    rows={6}
                    className={`w-full px-3 py-2 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm ${
                      errors.ssh_private_key ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
                    {...register('ssh_private_key')}
                  />
                  {errors.ssh_private_key && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.ssh_private_key.message}
                    </p>
                  )}
                </div>
                <Input
                  id="ssh_key_passphrase"
                  label="Key Passphrase"
                  type="password"
                  placeholder="Leave blank if key has no passphrase"
                  error={errors.ssh_key_passphrase?.message}
                  {...register('ssh_key_passphrase')}
                />
              </div>

              {/* Password Auth */}
              <div className="space-y-3 rounded-lg border border-gray-200 p-4">
                <p className="text-sm font-medium text-gray-700">
                  Password Authentication{' '}
                  <span className="text-gray-400 font-normal">(fallback if no key provided)</span>
                </p>
                <Input
                  id="ssh_password"
                  label="SSH Password"
                  type="password"
                  placeholder="Server login password"
                  error={errors.ssh_password?.message}
                  {...register('ssh_password')}
                />
              </div>

              {/* Test Connection */}
              <div className="flex items-center gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleTestConnection}
                  isLoading={isTesting}
                >
                  <Wifi className="w-4 h-4 mr-1" />
                  Test Connection
                </Button>
                {testResult === 'success' && (
                  <span className="text-sm text-green-600 font-medium">Connection successful</span>
                )}
                {testResult === 'failed' && (
                  <span className="text-sm text-red-600 font-medium">Connection failed</span>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Notes */}
        <Card>
          <CardHeader title="Additional Information" />
          <div>
            <label
              htmlFor="notes"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Notes (optional)
            </label>
            <textarea
              id="notes"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              placeholder="Any additional notes about this server..."
              {...register('notes')}
            />
          </div>
        </Card>

        {/* Submit */}
        <div className="flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate('/servers')}
          >
            Cancel
          </Button>
          <Button type="submit" isLoading={createServer.isPending}>
            Add Server
          </Button>
        </div>
      </form>
    </div>
  );
}
