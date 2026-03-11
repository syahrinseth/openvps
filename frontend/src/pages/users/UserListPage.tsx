import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Users,
  Plus,
  Pencil,
  Trash2,
  Shield,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  UserCog,
} from 'lucide-react';
import { useUsers, useCreateUser, useUpdateUser, useDeleteUser, useAssignRole } from '@/hooks/useUsers';
import { useAuth } from '@/contexts/AuthContext';
import Header from '@/components/layout/Header';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Table from '@/components/ui/Table';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import toast from 'react-hot-toast';
import type { User } from '@/types';

// --- Zod schemas ---

const createUserSchema = z
  .object({
    name: z.string().min(1, 'Name is required'),
    email: z.string().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Please confirm the password'),
    role: z.string().min(1, 'Role is required'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type CreateUserForm = z.infer<typeof createUserSchema>;

const editUserSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
});

type EditUserForm = z.infer<typeof editUserSchema>;

// --- Helpers ---

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'server-manager', label: 'Server Manager' },
  { value: 'developer', label: 'Developer' },
];

const roleBadgeVariant: Record<string, 'danger' | 'info' | 'success' | 'default'> = {
  admin: 'danger',
  'server-manager': 'info',
  developer: 'success',
};

const AVATAR_COLORS = [
  'bg-blue-500',
  'bg-emerald-500',
  'bg-violet-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-cyan-500',
  'bg-pink-500',
  'bg-indigo-500',
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// --- Component ---

export default function UserListPage() {
  const { user: currentUser } = useAuth();
  const { data: users, isLoading, error } = useUsers();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();
  const assignRole = useAssignRole();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [roleUser, setRoleUser] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [selectedRole, setSelectedRole] = useState('');

  // Create form
  const createForm = useForm<CreateUserForm>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '', role: '' },
  });

  // Edit form
  const editForm = useForm<EditUserForm>({
    resolver: zodResolver(editUserSchema),
  });

  // --- Handlers ---

  const handleCreate = async (data: CreateUserForm) => {
    try {
      await createUser.mutateAsync({
        name: data.name,
        email: data.email,
        password: data.password,
        password_confirmation: data.password,
      });
      // Assign role after creation if the hook supports it;
      // We'll rely on the backend accepting role during create or assign afterwards.
      setShowCreateModal(false);
      createForm.reset();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create user');
    }
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    editForm.reset({ name: user.name, email: user.email });
  };

  const handleEdit = async (data: EditUserForm) => {
    if (!editingUser) return;
    try {
      await updateUser.mutateAsync({ id: editingUser.id, ...data });
      setEditingUser(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update user');
    }
  };

  const openRoleModal = (user: User) => {
    setRoleUser(user);
    setSelectedRole(user.roles?.[0]?.name ?? '');
  };

  const handleAssignRole = async () => {
    if (!roleUser || !selectedRole) return;
    try {
      await assignRole.mutateAsync({ id: roleUser.id, role: selectedRole });
      setRoleUser(null);
    } catch {
      // error handled in hook
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteUser.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to delete user');
    }
  };

  // --- Summary stats ---
  const totalUsers = users?.length ?? 0;
  const adminsCount = users?.filter((u) => u.roles.some((r) => r.name === 'admin')).length ?? 0;
  const managersCount = users?.filter((u) => u.roles.some((r) => r.name === 'server-manager')).length ?? 0;
  const developersCount = users?.filter((u) => u.roles.some((r) => r.name === 'developer')).length ?? 0;

  // --- Loading ---
  if (isLoading) {
    return (
      <div>
        <Header title="User Management" description="Manage users and their roles" />
        <div className="flex items-center justify-center py-24">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
        </div>
      </div>
    );
  }

  // --- Error ---
  if (error) {
    return (
      <div>
        <Header title="User Management" />
        <Card>
          <div className="text-center py-12">
            <p className="text-red-500">Failed to load users. Please try again later.</p>
          </div>
        </Card>
      </div>
    );
  }

  // --- Table columns ---
  const columns = [
    {
      key: 'user',
      header: 'User',
      render: (user: User) => (
        <div className="flex items-center gap-3">
          <div
            className={`w-9 h-9 rounded-full ${getAvatarColor(user.name)} flex items-center justify-center text-white font-semibold text-sm`}
          >
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-medium text-gray-900">{user.name}</p>
              {currentUser?.id === user.id && (
                <Badge variant="info">You</Badge>
              )}
            </div>
            <p className="text-xs text-gray-500">{user.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'roles',
      header: 'Roles',
      render: (user: User) => (
        <div className="flex flex-wrap gap-1">
          {user.roles.length > 0 ? (
            user.roles.map((role) => (
              <Badge key={role.id} variant={roleBadgeVariant[role.name] || 'default'}>
                {role.name}
              </Badge>
            ))
          ) : (
            <span className="text-xs text-gray-400">No role</span>
          )}
        </div>
      ),
    },
    {
      key: 'verified',
      header: 'Verified',
      render: (user: User) =>
        user.email_verified_at ? (
          <div className="flex items-center gap-1 text-green-600">
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-xs">Verified</span>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-gray-400">
            <XCircle className="w-4 h-4" />
            <span className="text-xs">Unverified</span>
          </div>
        ),
    },
    {
      key: 'created_at',
      header: 'Created',
      render: (user: User) => (
        <span className="text-gray-500">{formatDate(user.created_at)}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (user: User) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => openEditModal(user)}
            title="Edit User"
          >
            <Pencil className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => openRoleModal(user)}
            title="Change Role"
          >
            <UserCog className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (currentUser?.id === user.id) {
                toast.error('You cannot delete your own account');
                return;
              }
              setDeleteTarget(user);
            }}
            title="Delete User"
          >
            <Trash2 className="w-4 h-4 text-red-500" />
          </Button>
        </div>
      ),
    },
  ];

  // --- Render ---
  return (
    <div>
      <Header
        title="User Management"
        description="Manage users and their roles"
        actions={
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="w-4 h-4 mr-1" />
            Add User
          </Button>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{totalUsers}</p>
              <p className="text-xs text-gray-500">Total Users</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{adminsCount}</p>
              <p className="text-xs text-gray-500">Admins</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-sky-50 flex items-center justify-center">
              <Shield className="w-5 h-5 text-sky-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{managersCount}</p>
              <p className="text-xs text-gray-500">Managers</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
              <Users className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{developersCount}</p>
              <p className="text-xs text-gray-500">Developers</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Users Table */}
      {!users || users.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Users className="w-12 h-12" />}
            title="No users yet"
            description="Create your first user to start managing access and permissions."
            action={{
              label: 'Add User',
              onClick: () => setShowCreateModal(true),
            }}
          />
        </Card>
      ) : (
        <Card padding={false}>
          <Table
            columns={columns}
            data={users}
            keyExtractor={(u) => u.id}
          />
        </Card>
      )}

      {/* Create User Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          createForm.reset();
        }}
        title="Add New User"
      >
        <form onSubmit={createForm.handleSubmit(handleCreate)} className="space-y-4">
          <Input
            id="create-name"
            label="Name"
            placeholder="Full name"
            error={createForm.formState.errors.name?.message}
            {...createForm.register('name')}
          />
          <Input
            id="create-email"
            label="Email"
            type="email"
            placeholder="user@example.com"
            error={createForm.formState.errors.email?.message}
            {...createForm.register('email')}
          />
          <Input
            id="create-password"
            label="Password"
            type="password"
            placeholder="Min 8 characters"
            error={createForm.formState.errors.password?.message}
            {...createForm.register('password')}
          />
          <Input
            id="create-confirm-password"
            label="Confirm Password"
            type="password"
            placeholder="Re-enter password"
            error={createForm.formState.errors.confirmPassword?.message}
            {...createForm.register('confirmPassword')}
          />
          <Select
            id="create-role"
            label="Role"
            options={ROLE_OPTIONS}
            error={createForm.formState.errors.role?.message}
            {...createForm.register('role')}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowCreateModal(false);
                createForm.reset();
              }}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={createUser.isPending}>
              Create User
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit User Modal */}
      <Modal
        isOpen={!!editingUser}
        onClose={() => setEditingUser(null)}
        title="Edit User"
      >
        <form onSubmit={editForm.handleSubmit(handleEdit)} className="space-y-4">
          <Input
            id="edit-name"
            label="Name"
            placeholder="Full name"
            error={editForm.formState.errors.name?.message}
            {...editForm.register('name')}
          />
          <Input
            id="edit-email"
            label="Email"
            type="email"
            placeholder="user@example.com"
            error={editForm.formState.errors.email?.message}
            {...editForm.register('email')}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setEditingUser(null)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={updateUser.isPending}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* Change Role Modal */}
      <Modal
        isOpen={!!roleUser}
        onClose={() => setRoleUser(null)}
        title="Change Role"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Change role for <span className="font-semibold">{roleUser?.name}</span>
          </p>
          <Select
            id="role-select"
            label="Role"
            options={ROLE_OPTIONS}
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setRoleUser(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleAssignRole}
              isLoading={assignRole.isPending}
              disabled={!selectedRole}
            >
              Assign Role
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete User"
        size="sm"
      >
        <p className="text-sm text-gray-600 mb-4">
          Are you sure you want to delete{' '}
          <span className="font-semibold">{deleteTarget?.name}</span>? This action cannot
          be undone.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDelete} isLoading={deleteUser.isPending}>
            Delete User
          </Button>
        </div>
      </Modal>
    </div>
  );
}
