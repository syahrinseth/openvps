import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Wifi } from 'lucide-react';
import { useCreateServer } from '@/hooks/useServers';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import Header from '@/components/layout/Header';
import Card, { CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';

const serverSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  hostname: z.string().min(1, 'Hostname is required'),
  ip_address: z
    .string()
    .min(1, 'IP address is required')
    .regex(
      /^(?:(?:\d{1,3}\.){3}\d{1,3}|[a-fA-F0-9:]+)$/,
      'Invalid IP address format'
    ),
  ssh_port: z.number().min(1).max(65535),
  ssh_user: z.string().min(1, 'SSH user is required'),
  ssh_private_key: z.string().min(1, 'SSH private key is required'),
  ssh_password: z.string().optional(),
  provider: z.string().min(1, 'Provider is required'),
  notes: z.string().optional(),
});

type ServerFormData = z.infer<typeof serverSchema>;

const providerOptions = [
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
    getValues,
    formState: { errors },
  } = useForm<ServerFormData>({
    resolver: zodResolver(serverSchema),
    defaultValues: {
      ssh_port: 22,
      ssh_user: 'root',
      provider: '',
    },
  });

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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                id="hostname"
                label="Hostname"
                placeholder="e.g., server1.example.com"
                error={errors.hostname?.message}
                {...register('hostname')}
              />
              <Input
                id="ip_address"
                label="IP Address"
                placeholder="e.g., 192.168.1.100"
                error={errors.ip_address?.message}
                {...register('ip_address')}
              />
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

        {/* SSH Configuration */}
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
              id="ssh_password"
              label="SSH Password (optional)"
              type="password"
              placeholder="Optional passphrase"
              error={errors.ssh_password?.message}
              {...register('ssh_password')}
            />

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
                <span className="text-sm text-green-600 font-medium">
                  Connection successful
                </span>
              )}
              {testResult === 'failed' && (
                <span className="text-sm text-red-600 font-medium">
                  Connection failed
                </span>
              )}
            </div>
          </div>
        </Card>

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
