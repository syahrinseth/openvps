import { useState } from 'react';
import {
  ShieldCheck,
  Plus,
  RefreshCw,
  Trash2,
  Server,
} from 'lucide-react';
import { useServers } from '@/hooks/useServers';
import {
  useSslCertificates,
  useRequestCertificate,
  useDeleteCertificate,
  useRenewCertificate,
} from '@/hooks/useSsl';
import Header from '@/components/layout/Header';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Table from '@/components/ui/Table';
import Badge from '@/components/ui/Badge';
import StatusIndicator from '@/components/ui/StatusIndicator';
import EmptyState from '@/components/ui/EmptyState';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import type { SslCertificate } from '@/types';

const typeBadgeVariant: Record<string, 'info' | 'default' | 'warning'> = {
  letsencrypt: 'info',
  custom: 'default',
  self_signed: 'warning',
};

const typeLabels: Record<string, string> = {
  letsencrypt: "Let's Encrypt",
  custom: 'Custom',
  self_signed: 'Self-Signed',
};

function getDaysUntilExpiry(expiresAt: string | null): number | null {
  if (!expiresAt) return null;
  const now = new Date();
  const expiry = new Date(expiresAt);
  const diffMs = expiry.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function getExpiryVariant(days: number | null): 'success' | 'warning' | 'danger' {
  if (days === null) return 'warning';
  if (days < 7) return 'danger';
  if (days <= 30) return 'warning';
  return 'success';
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function SslListPage() {
  const [selectedServerId, setSelectedServerId] = useState<number>(0);
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [deleteCert, setDeleteCert] = useState<SslCertificate | null>(null);
  const [formDomain, setFormDomain] = useState('');
  const [formType, setFormType] = useState('letsencrypt');
  const [formError, setFormError] = useState('');

  const { data: servers, isLoading: serversLoading } = useServers();
  const { data: certificates, isLoading: certsLoading } = useSslCertificates(selectedServerId);
  const requestCert = useRequestCertificate(selectedServerId);
  const deleteCertMutation = useDeleteCertificate(selectedServerId);
  const renewCert = useRenewCertificate(selectedServerId);

  const serverOptions = (servers || []).map((s) => ({
    value: String(s.id),
    label: `${s.name} (${s.ip_address})`,
  }));

  const certTypeOptions = [
    { value: 'letsencrypt', label: "Let's Encrypt" },
    { value: 'custom', label: 'Custom' },
    { value: 'self_signed', label: 'Self-Signed' },
  ];

  const openRequestModal = () => {
    setFormDomain('');
    setFormType('letsencrypt');
    setFormError('');
    setRequestModalOpen(true);
  };

  const handleRequest = async () => {
    if (!formDomain.trim()) {
      setFormError('Domain is required');
      return;
    }
    await requestCert.mutateAsync({
      domain: formDomain,
      type: formType,
    });
    setRequestModalOpen(false);
  };

  const handleDelete = async () => {
    if (!deleteCert) return;
    await deleteCertMutation.mutateAsync(deleteCert.id);
    setDeleteCert(null);
  };

  const columns = [
    {
      key: 'domain',
      header: 'Domain',
      render: (cert: SslCertificate) => (
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-gray-400" />
          <span className="font-medium text-gray-900">{cert.domain}</span>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (cert: SslCertificate) => (
        <Badge variant={typeBadgeVariant[cert.type] || 'default'}>
          {typeLabels[cert.type] || cert.type}
        </Badge>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (cert: SslCertificate) => (
        <StatusIndicator status={cert.status} />
      ),
    },
    {
      key: 'issued_at',
      header: 'Issued',
      render: (cert: SslCertificate) => (
        <span className="text-gray-500 text-xs">{formatDate(cert.issued_at)}</span>
      ),
    },
    {
      key: 'expires_at',
      header: 'Expires',
      render: (cert: SslCertificate) => {
        const days = getDaysUntilExpiry(cert.expires_at);
        const variant = getExpiryVariant(days);
        return (
          <div className="flex flex-col gap-0.5">
            <span className="text-gray-500 text-xs">{formatDate(cert.expires_at)}</span>
            {days !== null && (
              <Badge variant={variant}>
                {days <= 0 ? 'Expired' : `${days} day${days === 1 ? '' : 's'} left`}
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      key: 'auto_renew',
      header: 'Auto-Renew',
      render: (cert: SslCertificate) => (
        <Badge variant={cert.auto_renew ? 'success' : 'default'}>
          {cert.auto_renew ? 'On' : 'Off'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (cert: SslCertificate) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => renewCert.mutate(cert.id)}
            isLoading={renewCert.isPending}
            title="Renew Certificate"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDeleteCert(cert)}
            title="Delete Certificate"
          >
            <Trash2 className="w-4 h-4 text-red-500" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <Header
        title="SSL Certificates"
        description="Manage SSL/TLS certificates for your domains"
        actions={
          selectedServerId ? (
            <Button onClick={openRequestModal}>
              <Plus className="w-4 h-4 mr-1" />
              Request Certificate
            </Button>
          ) : undefined
        }
      />

      {/* Server Selector */}
      <div className="mb-6">
        <Select
          id="server-select"
          label="Select Server"
          options={serverOptions}
          value={String(selectedServerId)}
          onChange={(e) => setSelectedServerId(Number(e.target.value))}
          disabled={serversLoading}
        />
      </div>

      {/* Content */}
      {!selectedServerId ? (
        <Card>
          <EmptyState
            icon={<Server className="w-12 h-12" />}
            title="Select a server"
            description="Choose a server from the dropdown above to manage its SSL certificates."
          />
        </Card>
      ) : certsLoading ? (
        <div className="flex items-center justify-center py-24">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        </div>
      ) : !certificates || certificates.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ShieldCheck className="w-12 h-12" />}
            title="No SSL certificates"
            description="Request your first SSL certificate for a domain on this server."
            action={{
              label: 'Request Certificate',
              onClick: openRequestModal,
            }}
          />
        </Card>
      ) : (
        <Card padding={false}>
          <Table
            columns={columns}
            data={certificates}
            keyExtractor={(c) => c.id}
          />
        </Card>
      )}

      {/* Request Certificate Modal */}
      <Modal
        isOpen={requestModalOpen}
        onClose={() => setRequestModalOpen(false)}
        title="Request SSL Certificate"
      >
        <div className="space-y-4">
          <Input
            label="Domain"
            id="cert-domain"
            placeholder="example.com"
            value={formDomain}
            onChange={(e) => {
              setFormDomain(e.target.value);
              setFormError('');
            }}
            error={formError}
          />
          <Select
            label="Certificate Type"
            id="cert-type"
            options={certTypeOptions}
            value={formType}
            onChange={(e) => setFormType(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setRequestModalOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleRequest} isLoading={requestCert.isPending}>
            Request Certificate
          </Button>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteCert}
        onClose={() => setDeleteCert(null)}
        title="Delete SSL Certificate"
      >
        <p className="text-sm text-gray-600 mb-4">
          Are you sure you want to delete the SSL certificate for{' '}
          <span className="font-semibold">{deleteCert?.domain}</span>? This will
          revoke the certificate and may cause HTTPS to stop working for this domain.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setDeleteCert(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleDelete}
            isLoading={deleteCertMutation.isPending}
          >
            Delete Certificate
          </Button>
        </div>
      </Modal>
    </div>
  );
}
