import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Key, Copy, Check } from 'lucide-react';
import { useWebApp, useUpdateWebApp, useGenerateDeployKey } from '@/hooks/useWebApps';
import Header from '@/components/layout/Header';
import Card, { CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';

const webAppSchema = z.object({
  name: z.string().min(1, 'App name is required'),
  domain: z.string().min(1, 'Domain is required'),
  app_type: z.enum(['laravel', 'nodejs', 'react', 'static', 'custom']),
  git_repository: z.string().optional(),
  git_branch: z.string().optional(),
  git_token: z.string().optional(),
  deploy_path: z.string().min(1, 'Deploy path is required'),
  docker_compose_path: z.string().optional(),
  port: z
    .string()
    .optional()
    .refine(
      (v) => !v || (!isNaN(Number(v)) && Number(v) >= 1 && Number(v) <= 65535),
      { message: 'Port must be between 1 and 65535' }
    ),
  docker_container_name: z.string().optional(),
  auto_deploy: z.boolean(),
});

type EditWebAppFormValues = z.infer<typeof webAppSchema>;

const appTypeOptions = [
  { value: 'laravel', label: 'Laravel (PHP)' },
  { value: 'nodejs', label: 'Node.js' },
  { value: 'react', label: 'React / Static SPA' },
  { value: 'static', label: 'Static Files' },
  { value: 'custom', label: 'Custom' },
];

export default function EditWebAppPage() {
  const { serverId, appId } = useParams<{ serverId: string; appId: string }>();
  const navigate = useNavigate();
  const serverIdNum = Number(serverId);
  const appIdNum = Number(appId);

  const { data: app, isLoading } = useWebApp(serverIdNum, appIdNum);
  const updateWebApp = useUpdateWebApp(serverIdNum);
  const generateDeployKey = useGenerateDeployKey(serverIdNum);
  const [copied, setCopied] = useState(false);

  const handleCopyPublicKey = () => {
    if (app?.git_deploy_key_public) {
      navigator.clipboard.writeText(app.git_deploy_key_public);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const form = useForm<EditWebAppFormValues>({
    resolver: zodResolver(webAppSchema),
    defaultValues: {
      name: '',
      domain: '',
      app_type: 'laravel',
      git_repository: '',
      git_branch: 'main',
      git_token: '',
      deploy_path: '/var/www/',
      docker_compose_path: '',
      port: '',
      docker_container_name: '',
      auto_deploy: false,
    },
  });

  // Pre-populate form once app data is loaded
  useEffect(() => {
    if (app) {
      form.reset({
        name: app.name ?? '',
        domain: app.domain ?? '',
        app_type: app.app_type as EditWebAppFormValues['app_type'],
        git_repository: app.git_repository ?? '',
        git_branch: app.git_branch ?? 'main',
        git_token: '', // never pre-fill — token is write-only
        deploy_path: app.deploy_path ?? '/var/www/',
        docker_compose_path: app.docker_compose_path ?? '',
        port: app.port ? String(app.port) : '',
        docker_container_name: app.docker_container_name ?? '',
        auto_deploy: app.auto_deploy ?? false,
      });
    }
  }, [app, form]);

  const onSubmit = (values: EditWebAppFormValues) => {
    const { port, git_token, ...rest } = values;
    updateWebApp.mutate(
      {
        appId: appIdNum,
        data: {
          ...rest,
          port: port ? Number(port) : undefined,
          // Only send git_token if the user actually typed a new one
          ...(git_token ? { git_token } : {}),
        },
      },
      {
        onSuccess: () => {
          navigate(`/web-apps/${serverId}/${appId}`);
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!app) {
    return (
      <div>
        <Header title="Web App Not Found" />
        <Card>
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">
              The web app you're looking for doesn't exist or you don't have access.
            </p>
            <Button variant="secondary" onClick={() => navigate('/web-apps')}>
              Back to Web Apps
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <button
          onClick={() => navigate(`/web-apps/${serverId}/${appId}`)}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to {app.name}
        </button>
      </div>

      <Header
        title={`Edit ${app.name}`}
        description="Update the configuration for this web application"
        actions={
          <Button
            variant="secondary"
            onClick={() => navigate(`/web-apps/${serverId}/${appId}`)}
          >
            Cancel
          </Button>
        }
      />

      <Card>
        <CardHeader title="Application Details" />
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 mt-4">
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
            <p className="text-xs text-gray-500 -mt-3">
              Changing the domain will automatically restart the app to apply the new routing.
            </p>
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

          <div>
            <Input
              id="git_token"
              label="Git Access Token (for private repos)"
              type="password"
              placeholder={app.has_git_token ? 'Leave blank to keep existing token' : 'ghp_xxxxxxxxxxxxxxxxxxxx'}
              {...form.register('git_token')}
            />
            {app.has_git_token && (
              <p className="text-xs text-green-600 mt-1">A token is currently saved. Enter a new one to replace it.</p>
            )}
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
              error={form.formState.errors.port?.message}
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
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate(`/web-apps/${serverId}/${appId}`)}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={updateWebApp.isPending}>
              Save Changes
            </Button>
          </div>
        </form>
      </Card>

      {/* Deploy Key section */}
      <Card className="mt-6">
        <CardHeader
          title="SSH Deploy Key"
          description="Use an SSH deploy key to authenticate git clone and pull for private repositories without a Personal Access Token."
        />
        <div className="mt-4 space-y-4">
          {app.has_git_deploy_key ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">
                <Key className="w-4 h-4 flex-shrink-0" />
                <span>A deploy key is currently saved for this app.</span>
              </div>

              {app.git_deploy_key_public && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Public Key — add this to your repository's Deploy Keys
                  </label>
                  <div className="relative">
                    <textarea
                      readOnly
                      rows={4}
                      value={app.git_deploy_key_public}
                      className="w-full font-mono text-xs bg-gray-50 border border-gray-300 rounded-md px-3 py-2 pr-12 resize-none focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleCopyPublicKey}
                      className="absolute top-2 right-2 p-1.5 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                      title="Copy public key"
                    >
                      {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    GitHub: Settings → Deploy keys → Add deploy key. Make sure your repository URL uses SSH format:{' '}
                    <code className="bg-gray-100 px-1 rounded">git@github.com:user/repo.git</code>
                  </p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No deploy key is set. Generate one to use SSH-based authentication.</p>
          )}

          <Button
            type="button"
            variant="secondary"
            isLoading={generateDeployKey.isPending}
            onClick={() => generateDeployKey.mutate(appIdNum)}
          >
            <Key className="w-4 h-4 mr-2" />
            {app.has_git_deploy_key ? 'Regenerate Deploy Key' : 'Generate Deploy Key'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
