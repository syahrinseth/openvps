import { useState } from 'react';
import {
  Shield,
  Plus,
  RefreshCw,
  Pencil,
  Trash2,
  Server,
  ShieldCheck,
  ShieldOff,
} from 'lucide-react';
import { useServers } from '@/hooks/useServers';
import {
  useFirewallRules,
  useCreateFirewallRule,
  useUpdateFirewallRule,
  useDeleteFirewallRule,
  useFirewallStatus,
  useSyncFirewall,
} from '@/hooks/useFirewall';
import Header from '@/components/layout/Header';
import Card, { CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Table from '@/components/ui/Table';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import type { FirewallRule } from '@/types';

interface FirewallFormData {
  rule_type: string;
  direction: string;
  protocol: string;
  port: string;
  from_ip: string;
  to_ip: string;
  description: string;
}

const emptyForm: FirewallFormData = {
  rule_type: 'allow',
  direction: 'in',
  protocol: 'tcp',
  port: '',
  from_ip: '',
  to_ip: '',
  description: '',
};

const ruleTypeBadge: Record<string, 'success' | 'danger' | 'warning'> = {
  allow: 'success',
  deny: 'danger',
  limit: 'warning',
};

const directionBadge: Record<string, 'info' | 'default'> = {
  in: 'info',
  out: 'default',
};

export default function FirewallListPage() {
  const [selectedServerId, setSelectedServerId] = useState<number>(0);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editRule, setEditRule] = useState<FirewallRule | null>(null);
  const [deleteRule, setDeleteRule] = useState<FirewallRule | null>(null);
  const [formData, setFormData] = useState<FirewallFormData>(emptyForm);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof FirewallFormData, string>>>({});

  const { data: servers, isLoading: serversLoading } = useServers();
  const { data: rules, isLoading: rulesLoading } = useFirewallRules(selectedServerId);
  const { data: firewallStatus } = useFirewallStatus(selectedServerId);
  const createRule = useCreateFirewallRule(selectedServerId);
  const updateRule = useUpdateFirewallRule(selectedServerId);
  const deleteRuleMutation = useDeleteFirewallRule(selectedServerId);
  const syncFirewall = useSyncFirewall(selectedServerId);

  const serverOptions = (servers || []).map((s) => ({
    value: String(s.id),
    label: `${s.name} (${s.ip_address})`,
  }));

  const ruleTypeOptions = [
    { value: 'allow', label: 'Allow' },
    { value: 'deny', label: 'Deny' },
    { value: 'limit', label: 'Limit' },
  ];

  const directionOptions = [
    { value: 'in', label: 'Inbound' },
    { value: 'out', label: 'Outbound' },
  ];

  const protocolOptions = [
    { value: 'tcp', label: 'TCP' },
    { value: 'udp', label: 'UDP' },
    { value: 'any', label: 'Any' },
  ];

  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof FirewallFormData, string>> = {};
    if (!formData.port.trim()) errors.port = 'Port is required';
    if (!formData.rule_type) errors.rule_type = 'Rule type is required';
    if (!formData.direction) errors.direction = 'Direction is required';
    if (!formData.protocol) errors.protocol = 'Protocol is required';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const openCreateModal = () => {
    setFormData(emptyForm);
    setFormErrors({});
    setCreateModalOpen(true);
  };

  const openEditModal = (rule: FirewallRule) => {
    setFormData({
      rule_type: rule.rule_type,
      direction: rule.direction,
      protocol: rule.protocol,
      port: rule.port,
      from_ip: rule.from_ip || '',
      to_ip: rule.to_ip || '',
      description: rule.description || '',
    });
    setFormErrors({});
    setEditRule(rule);
  };

  const handleCreate = async () => {
    if (!validateForm()) return;
    await createRule.mutateAsync({
      rule_type: formData.rule_type,
      direction: formData.direction,
      protocol: formData.protocol,
      port: formData.port,
      from_ip: formData.from_ip || undefined,
      to_ip: formData.to_ip || undefined,
      description: formData.description || undefined,
    });
    setCreateModalOpen(false);
    setFormData(emptyForm);
  };

  const handleUpdate = async () => {
    if (!editRule || !validateForm()) return;
    await updateRule.mutateAsync({
      id: editRule.id,
      rule_type: formData.rule_type,
      direction: formData.direction,
      protocol: formData.protocol,
      port: formData.port,
      from_ip: formData.from_ip || undefined,
      to_ip: formData.to_ip || undefined,
      description: formData.description || undefined,
    });
    setEditRule(null);
    setFormData(emptyForm);
  };

  const handleDelete = async () => {
    if (!deleteRule) return;
    await deleteRuleMutation.mutateAsync(deleteRule.id);
    setDeleteRule(null);
  };

  const handleToggleActive = async (rule: FirewallRule) => {
    await updateRule.mutateAsync({
      id: rule.id,
      rule_type: rule.rule_type,
      direction: rule.direction,
      protocol: rule.protocol,
      port: rule.port,
    });
  };

  const columns = [
    {
      key: 'rule_type',
      header: 'Type',
      render: (rule: FirewallRule) => (
        <Badge variant={ruleTypeBadge[rule.rule_type] || 'default'}>
          {rule.rule_type.toUpperCase()}
        </Badge>
      ),
    },
    {
      key: 'direction',
      header: 'Direction',
      render: (rule: FirewallRule) => (
        <Badge variant={directionBadge[rule.direction] || 'default'}>
          {rule.direction === 'in' ? 'IN' : 'OUT'}
        </Badge>
      ),
    },
    {
      key: 'protocol',
      header: 'Protocol',
      render: (rule: FirewallRule) => (
        <span className="text-gray-700 font-mono text-xs uppercase">
          {rule.protocol}
        </span>
      ),
    },
    {
      key: 'port',
      header: 'Port',
      render: (rule: FirewallRule) => (
        <span className="text-gray-900 font-mono text-sm">{rule.port}</span>
      ),
    },
    {
      key: 'from_ip',
      header: 'Source IP',
      render: (rule: FirewallRule) => (
        <span className={`text-sm ${rule.from_ip ? 'text-gray-700 font-mono' : 'text-gray-400 italic'}`}>
          {rule.from_ip || 'Anywhere'}
        </span>
      ),
    },
    {
      key: 'description',
      header: 'Description',
      render: (rule: FirewallRule) => (
        <span className="text-gray-500 text-sm truncate max-w-[200px] block">
          {rule.description || '—'}
        </span>
      ),
    },
    {
      key: 'is_active',
      header: 'Active',
      render: (rule: FirewallRule) => (
        <button
          onClick={() => handleToggleActive(rule)}
          title={rule.is_active ? 'Click to deactivate' : 'Click to activate'}
        >
          <Badge variant={rule.is_active ? 'success' : 'default'}>
            {rule.is_active ? 'Active' : 'Inactive'}
          </Badge>
        </button>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (rule: FirewallRule) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => openEditModal(rule)}
            title="Edit Rule"
          >
            <Pencil className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDeleteRule(rule)}
            title="Delete Rule"
          >
            <Trash2 className="w-4 h-4 text-red-500" />
          </Button>
        </div>
      ),
    },
  ];

  const renderForm = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <Select
          label="Rule Type"
          id="rule-type"
          options={ruleTypeOptions}
          value={formData.rule_type}
          onChange={(e) => setFormData({ ...formData, rule_type: e.target.value })}
          error={formErrors.rule_type}
        />
        <Select
          label="Direction"
          id="rule-direction"
          options={directionOptions}
          value={formData.direction}
          onChange={(e) => setFormData({ ...formData, direction: e.target.value })}
          error={formErrors.direction}
        />
        <Select
          label="Protocol"
          id="rule-protocol"
          options={protocolOptions}
          value={formData.protocol}
          onChange={(e) => setFormData({ ...formData, protocol: e.target.value })}
          error={formErrors.protocol}
        />
      </div>
      <Input
        label="Port"
        id="rule-port"
        placeholder="80 or 8000:9000"
        value={formData.port}
        onChange={(e) => setFormData({ ...formData, port: e.target.value })}
        error={formErrors.port}
      />
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="From IP (optional)"
          id="rule-from-ip"
          placeholder="Leave empty for anywhere"
          value={formData.from_ip}
          onChange={(e) => setFormData({ ...formData, from_ip: e.target.value })}
        />
        <Input
          label="To IP (optional)"
          id="rule-to-ip"
          placeholder="Leave empty for anywhere"
          value={formData.to_ip}
          onChange={(e) => setFormData({ ...formData, to_ip: e.target.value })}
        />
      </div>
      <Input
        label="Description (optional)"
        id="rule-description"
        placeholder="e.g., Allow HTTP traffic"
        value={formData.description}
        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
      />
    </div>
  );

  return (
    <div>
      <Header
        title="Firewall Rules"
        description="Manage firewall rules across your servers"
        actions={
          selectedServerId ? (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => syncFirewall.mutate()}
                isLoading={syncFirewall.isPending}
              >
                <RefreshCw className="w-4 h-4 mr-1" />
                Sync Rules
              </Button>
              <Button onClick={openCreateModal}>
                <Plus className="w-4 h-4 mr-1" />
                Add Rule
              </Button>
            </div>
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
            description="Choose a server from the dropdown above to manage its firewall rules."
          />
        </Card>
      ) : (
        <>
          {/* Firewall Status Card */}
          <Card className="mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {firewallStatus?.enabled ? (
                  <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5 text-green-600" />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                    <ShieldOff className="w-5 h-5 text-gray-400" />
                  </div>
                )}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Firewall Status</h3>
                  <p className="text-xs text-gray-500">
                    {firewallStatus?.enabled
                      ? 'Firewall is active and protecting your server'
                      : 'Firewall is currently disabled'}
                  </p>
                </div>
              </div>
              <Badge variant={firewallStatus?.enabled ? 'success' : 'danger'}>
                {firewallStatus?.enabled ? 'Enabled' : 'Disabled'}
              </Badge>
            </div>
          </Card>

          {/* Rules Table */}
          {rulesLoading ? (
            <div className="flex items-center justify-center py-24">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
            </div>
          ) : !rules || rules.length === 0 ? (
            <Card>
              <EmptyState
                icon={<Shield className="w-12 h-12" />}
                title="No firewall rules"
                description="Create your first firewall rule to control traffic to this server."
                action={{
                  label: 'Add Rule',
                  onClick: openCreateModal,
                }}
              />
            </Card>
          ) : (
            <Card padding={false}>
              <Table
                columns={columns}
                data={rules}
                keyExtractor={(r) => r.id}
              />
            </Card>
          )}
        </>
      )}

      {/* Create Rule Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Add Firewall Rule"
        size="lg"
      >
        {renderForm()}
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setCreateModalOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} isLoading={createRule.isPending}>
            Create Rule
          </Button>
        </div>
      </Modal>

      {/* Edit Rule Modal */}
      <Modal
        isOpen={!!editRule}
        onClose={() => setEditRule(null)}
        title="Edit Firewall Rule"
        size="lg"
      >
        {renderForm()}
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" onClick={() => setEditRule(null)}>
            Cancel
          </Button>
          <Button onClick={handleUpdate} isLoading={updateRule.isPending}>
            Save Changes
          </Button>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteRule}
        onClose={() => setDeleteRule(null)}
        title="Delete Firewall Rule"
      >
        <p className="text-sm text-gray-600 mb-4">
          Are you sure you want to delete this firewall rule?{' '}
          {deleteRule && (
            <span className="font-semibold">
              {deleteRule.rule_type.toUpperCase()} {deleteRule.protocol.toUpperCase()}/{deleteRule.port}
              {deleteRule.from_ip ? ` from ${deleteRule.from_ip}` : ''}
            </span>
          )}
          . This may affect network access to your server.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setDeleteRule(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleDelete}
            isLoading={deleteRuleMutation.isPending}
          >
            Delete Rule
          </Button>
        </div>
      </Modal>
    </div>
  );
}
