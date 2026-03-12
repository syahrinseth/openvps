import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft } from 'lucide-react';
import { useServers } from '@/hooks/useServers';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import Header from '@/components/layout/Header';
import Card, { CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';

const webAppSchema = z.object({
  server_id: z.number().min(1, 'Server is required'),
  name: z.string().min(1, 'App name is required'),
  domain: z.string().min(1, 'Domain is required'),
  app_type: z.enum(['laravel', 'nodejs', 'react', 'static', 'custom']),
  git_repository: z.string().optional(),
  git_branch: z.string().optional(),
  deploy_path: z.string().min(1, 'Deploy path is required'),
  docker_compose_path: z.string().optional(),
  port: z.number().min(1).max(65535).optional(),
  docker_container_name: z.string().optional(),
  auto_deploy: z.boolean(),
});

type WebAppFormValues = z.infer<typeof webAppSchema>;

const appTypeOptions = [
  { value: 'laravel', label: 'Laravel (PHP)' },
  { value: 'nodejs', label: 'Node.js' },
  { value: 'react', label: 'React / Static SPA' },
  { value: 'static', label: 'Static Files' },
  { value: 'custom', label: 'Custom' },
];

export default function AddWebAppPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedServerId = Number(searchParams.get('server') ?? 0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: servers } = useServers();

  const serverOptions = (servers ?? []).map((s) => ({
    value: String(s.id),
    label: `${s.name} (${s.ip_address})`,
  }));

  const form = useForm<WebAppFormValues>({
    resolver: zodResolver(webAppSchema),
    defaultValues: {
      server_id: preselectedServerId || 0,
      app_type: 'laravel',
      git_branch: 'main',
      deploy_path: '/var/www/',
      auto_deploy: false,
    },
  });

  const onSubmit = async (values: WebAppFormValues) => {
    setIsSubmitting(true);
    try {
      const { server_id, ...rest } = values;
      await api.post(`/servers/${server_id}/web-apps`, rest);
      toast.success('Web app created successfully');
      navigate(`/web-apps`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create web app');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <Header
        title="Add Web App"
        description="Deploy a new web application to your server"
        actions={
          <Button variant="secondary" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
        }
      />

      <Card>
        <CardHeader title="Web App Details" />
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 mt-4">
          {/* Server */}
          <Select
            id="server_id"
            label="Server"
            options={serverOptions}
            value={String(form.watch('server_id') ?? '')}
            onChange={(e) => form.setValue('server_id', e.target.value ? Number(e.target.value) : 0)}
            error={form.formState.errors.server_id?.message}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              id="name"
              label="App Name"
              placeholder="my-app"
              error={form.formState.errors.name?.message}
              {...form.register('name')}
            />
            <Input
              id="domain"
              label="Domain"
              placeholder="example.com"
              error={form.formState.errors.domain?.message}
              {...form.register('domain')}
            />
          </div>

          <Select
            id="app_type"
            label="App Type"
            options={appTypeOptions}
            error={form.formState.errors.app_type?.message}
            {...form.register('app_type')}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              id="git_repository"
              label="Git Repository URL"
              placeholder="https://github.com/user/repo.git"
              {...form.register('git_repository')}
            />
            <Input
              id="git_branch"
              label="Branch"
              placeholder="main"
              {...form.register('git_branch')}
            />
          </div>

          <Input
            id="deploy_path"
            label="Deploy Path"
            placeholder="/var/www/my-app"
            error={form.formState.errors.deploy_path?.message}
            {...form.register('deploy_path')}
          />

          <Input
            id="docker_compose_path"
            label="Docker Compose File Path (optional)"
            placeholder="/var/www/my-app/docker-compose.yml"
            {...form.register('docker_compose_path')}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              id="port"
              label="Port (optional)"
              type="number"
              placeholder="3000"
              {...form.register('port')}
            />
            <Input
              id="docker_container_name"
              label="Docker Container Name (optional)"
              placeholder="my-app-web"
              {...form.register('docker_container_name')}
            />
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="auto_deploy"
              className="w-4 h-4 text-blue-600 rounded border-gray-300"
              {...form.register('auto_deploy')}
            />
            <label htmlFor="auto_deploy" className="text-sm font-medium text-gray-700">
              Enable auto-deploy on GitHub push
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              Create Web App
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
