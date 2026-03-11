import { useState } from 'react';
import {
  Database,
  Users,
  Plus,
  Trash2,
  Edit,
  Download,
  Server,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Header from '@/components/layout/Header';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import Table from '@/components/ui/Table';
import EmptyState from '@/components/ui/EmptyState';
import { useServers } from '@/hooks/useServers';
import {
  useDatabases,
  useCreateDatabase,
  useDeleteDatabase,
  useBackupDatabase,
  useDatabaseUsers,
  useCreateDatabaseUser,
  useUpdateDatabaseUser,
  useDeleteDatabaseUser,
} from '@/hooks/useDatabases';
import type { Database as DatabaseType, DatabaseUser } from '@/types';

type TabKey = 'databases' | 'users';

const CHARSET_OPTIONS = [
  { value: 'utf8mb4', label: 'utf8mb4' },
  { value: 'utf8', label: 'utf8' },
  { value: 'latin1', label: 'latin1' },
];

const COLLATION_OPTIONS = [
  { value: 'utf8mb4_unicode_ci', label: 'utf8mb4_unicode_ci' },
  { value: 'utf8mb4_general_ci', label: 'utf8mb4_general_ci' },
  { value: 'utf8_general_ci', label: 'utf8_general_ci' },
];

const PRIVILEGE_OPTIONS = [
  'ALL',
  'SELECT',
  'INSERT',
  'UPDATE',
  'DELETE',
  'CREATE',
  'DROP',
  'ALTER',
  'INDEX',
];

function formatSize(sizeMb: number | null): string {
  if (sizeMb === null || sizeMb === undefined) return '--';
  if (sizeMb >= 1024) return `${(sizeMb / 1024).toFixed(2)} GB`;
  return `${sizeMb.toFixed(2)} MB`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function DatabaseListPage() {
  const [selectedServerId, setSelectedServerId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('databases');

  // Modals
  const [showCreateDb, setShowCreateDb] = useState(false);
  const [showDropDb, setShowDropDb] = useState<DatabaseType | null>(null);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [showEditUser, setShowEditUser] = useState<DatabaseUser | null>(null);
  const [showDeleteUser, setShowDeleteUser] = useState<DatabaseUser | null>(null);

  // Form state: Create database
  const [dbName, setDbName] = useState('');
  const [dbCharset, setDbCharset] = useState('utf8mb4');
  const [dbCollation, setDbCollation] = useState('utf8mb4_unicode_ci');

  // Form state: Drop database confirmation
  const [dropConfirmName, setDropConfirmName] = useState('');

  // Form state: Create user
  const [userName, setUserName] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [userDatabaseId, setUserDatabaseId] = useState('');
  const [userHost, setUserHost] = useState('%');
  const [userPrivileges, setUserPrivileges] = useState<string[]>([]);

  // Form state: Edit user
  const [editPrivileges, setEditPrivileges] = useState<string[]>([]);

  const serverId = selectedServerId ?? 0;

  // Queries
  const { data: servers, isLoading: serversLoading } = useServers();
  const { data: databases, isLoading: dbLoading } = useDatabases(serverId);
  const { data: dbUsers, isLoading: usersLoading } = useDatabaseUsers(serverId);

  // Mutations
  const createDb = useCreateDatabase(serverId);
  const deleteDb = useDeleteDatabase(serverId);
  const backupDb = useBackupDatabase(serverId);
  const createUser = useCreateDatabaseUser(serverId);
  const updateUser = useUpdateDatabaseUser(serverId);
  const deleteUser = useDeleteDatabaseUser(serverId);

  const serverOptions = (servers ?? []).map((s) => ({
    value: String(s.id),
    label: `${s.name} (${s.ip_address})`,
  }));

  const databaseSelectOptions = (databases ?? []).map((d) => ({
    value: String(d.id),
    label: d.name,
  }));

  // --- Handlers ---

  function resetCreateDbForm() {
    setDbName('');
    setDbCharset('utf8mb4');
    setDbCollation('utf8mb4_unicode_ci');
  }

  function resetCreateUserForm() {
    setUserName('');
    setUserPassword('');
    setUserDatabaseId('');
    setUserHost('%');
    setUserPrivileges([]);
  }

  function handleCreateDatabase(e: React.FormEvent) {
    e.preventDefault();
    if (!dbName.trim()) return;
    if (!/^[a-zA-Z0-9_]+$/.test(dbName)) {
      toast.error('Database name must contain only alphanumeric characters and underscores');
      return;
    }
    createDb.mutate(
      { name: dbName, charset: dbCharset, collation: dbCollation },
      {
        onSuccess: () => {
          setShowCreateDb(false);
          resetCreateDbForm();
        },
        onError: () => toast.error('Failed to create database'),
      }
    );
  }

  function handleDropDatabase() {
    if (!showDropDb || dropConfirmName !== showDropDb.name) return;
    deleteDb.mutate(showDropDb.id, {
      onSuccess: () => {
        setShowDropDb(null);
        setDropConfirmName('');
      },
      onError: () => toast.error('Failed to drop database'),
    });
  }

  function handleBackup(db: DatabaseType) {
    backupDb.mutate(db.id);
  }

  function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    if (!userName.trim() || !userPassword.trim()) return;
    createUser.mutate(
      {
        username: userName,
        password: userPassword,
        database_id: userDatabaseId ? Number(userDatabaseId) : undefined,
        host: userHost || '%',
        privileges: userPrivileges.length > 0 ? userPrivileges : undefined,
      },
      {
        onSuccess: () => {
          setShowCreateUser(false);
          resetCreateUserForm();
        },
        onError: () => toast.error('Failed to create database user'),
      }
    );
  }

  function handleOpenEditUser(user: DatabaseUser) {
    setEditPrivileges([...user.privileges]);
    setShowEditUser(user);
  }

  function handleUpdateUser() {
    if (!showEditUser) return;
    updateUser.mutate(
      { id: showEditUser.id, privileges: editPrivileges },
      {
        onSuccess: () => {
          setShowEditUser(null);
          setEditPrivileges([]);
        },
        onError: () => toast.error('Failed to update user'),
      }
    );
  }

  function handleDeleteUser() {
    if (!showDeleteUser) return;
    deleteUser.mutate(showDeleteUser.id, {
      onSuccess: () => setShowDeleteUser(null),
      onError: () => toast.error('Failed to delete user'),
    });
  }

  function togglePrivilege(priv: string, list: string[], setter: (v: string[]) => void) {
    if (priv === 'ALL') {
      setter(list.includes('ALL') ? [] : ['ALL']);
      return;
    }
    const without = list.filter((p) => p !== 'ALL');
    setter(
      without.includes(priv) ? without.filter((p) => p !== priv) : [...without, priv]
    );
  }

  // --- Columns ---

  const dbColumns = [
    {
      key: 'name',
      header: 'Name',
      render: (db: DatabaseType) => (
        <span className="font-medium text-gray-900">{db.name}</span>
      ),
    },
    { key: 'charset', header: 'Charset' },
    { key: 'collation', header: 'Collation' },
    {
      key: 'size_mb',
      header: 'Size',
      render: (db: DatabaseType) => formatSize(db.size_mb),
    },
    {
      key: 'created_at',
      header: 'Created',
      render: (db: DatabaseType) => formatDate(db.created_at),
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (db: DatabaseType) => (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleBackup(db)}
            disabled={backupDb.isPending}
          >
            <Download className="w-4 h-4 mr-1" />
            Backup
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setDropConfirmName('');
              setShowDropDb(db);
            }}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4 mr-1" />
            Drop
          </Button>
        </div>
      ),
    },
  ];

  const userColumns = [
    {
      key: 'username',
      header: 'Username',
      render: (u: DatabaseUser) => (
        <span className="font-medium text-gray-900">{u.username}</span>
      ),
    },
    { key: 'host', header: 'Host' },
    {
      key: 'database_id',
      header: 'Database',
      render: (u: DatabaseUser) => {
        const db = databases?.find((d) => d.id === u.database_id);
        return db ? (
          <Badge variant="info">{db.name}</Badge>
        ) : (
          <span className="text-gray-400">--</span>
        );
      },
    },
    {
      key: 'privileges',
      header: 'Privileges',
      render: (u: DatabaseUser) => (
        <div className="flex flex-wrap gap-1">
          {u.privileges.map((p) => (
            <Badge key={p} variant={p === 'ALL' ? 'success' : 'default'}>
              {p}
            </Badge>
          ))}
          {u.privileges.length === 0 && (
            <span className="text-gray-400">None</span>
          )}
        </div>
      ),
    },
    {
      key: 'created_at',
      header: 'Created',
      render: (u: DatabaseUser) => formatDate(u.created_at),
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (u: DatabaseUser) => (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleOpenEditUser(u)}
          >
            <Edit className="w-4 h-4 mr-1" />
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDeleteUser(u)}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4 mr-1" />
            Delete
          </Button>
        </div>
      ),
    },
  ];

  // --- Render ---

  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'databases', label: 'Databases', icon: <Database className="w-4 h-4" /> },
    { key: 'users', label: 'Users', icon: <Users className="w-4 h-4" /> },
  ];

  return (
    <div>
      <Header
        title="Databases"
        description="Manage MySQL databases and users"
      />

      {/* Server Selector */}
      <div className="mb-6">
        <Card>
          <div className="flex items-center gap-3">
            <Server className="w-5 h-5 text-gray-400" />
            <Select
              id="server-selector"
              label=""
              options={serverOptions}
              value={selectedServerId ? String(selectedServerId) : ''}
              onChange={(e) =>
                setSelectedServerId(e.target.value ? Number(e.target.value) : null)
              }
              disabled={serversLoading}
              className="max-w-xs"
            />
            {serversLoading && (
              <span className="text-sm text-gray-500">Loading servers...</span>
            )}
          </div>
        </Card>
      </div>

      {/* No server selected prompt */}
      {!selectedServerId && (
        <Card>
          <EmptyState
            icon={<Server className="w-12 h-12" />}
            title="Select a Server"
            description="Choose a server from the dropdown above to manage its databases and users."
          />
        </Card>
      )}

      {/* Main content */}
      {selectedServerId && (
        <>
          {/* Tabs */}
          <div className="flex items-center gap-1 mb-6 border-b border-gray-200">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Databases Tab */}
          {activeTab === 'databases' && (
            <Card padding={false}>
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Databases</h3>
                <Button size="sm" onClick={() => setShowCreateDb(true)}>
                  <Plus className="w-4 h-4 mr-1" />
                  Create Database
                </Button>
              </div>

              {dbLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                </div>
              ) : databases && databases.length > 0 ? (
                <Table
                  columns={dbColumns}
                  data={databases}
                  keyExtractor={(db) => db.id}
                />
              ) : (
                <EmptyState
                  icon={<Database className="w-12 h-12" />}
                  title="No Databases"
                  description="Get started by creating your first database on this server."
                  action={{
                    label: 'Create Database',
                    onClick: () => setShowCreateDb(true),
                  }}
                />
              )}
            </Card>
          )}

          {/* Users Tab */}
          {activeTab === 'users' && (
            <Card padding={false}>
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">
                  Database Users
                </h3>
                <Button size="sm" onClick={() => setShowCreateUser(true)}>
                  <Plus className="w-4 h-4 mr-1" />
                  Create User
                </Button>
              </div>

              {usersLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                </div>
              ) : dbUsers && dbUsers.length > 0 ? (
                <Table
                  columns={userColumns}
                  data={dbUsers}
                  keyExtractor={(u) => u.id}
                />
              ) : (
                <EmptyState
                  icon={<Users className="w-12 h-12" />}
                  title="No Database Users"
                  description="Create a database user to grant access to your databases."
                  action={{
                    label: 'Create User',
                    onClick: () => setShowCreateUser(true),
                  }}
                />
              )}
            </Card>
          )}
        </>
      )}

      {/* Create Database Modal */}
      <Modal
        isOpen={showCreateDb}
        onClose={() => {
          setShowCreateDb(false);
          resetCreateDbForm();
        }}
        title="Create Database"
      >
        <form onSubmit={handleCreateDatabase} className="space-y-4">
          <Input
            id="db-name"
            label="Database Name"
            value={dbName}
            onChange={(e) => setDbName(e.target.value)}
            placeholder="my_database"
            required
          />
          <p className="text-xs text-gray-500 -mt-2">
            Alphanumeric characters and underscores only.
          </p>
          <Select
            id="db-charset"
            label="Charset"
            options={CHARSET_OPTIONS}
            value={dbCharset}
            onChange={(e) => setDbCharset(e.target.value)}
          />
          <Select
            id="db-collation"
            label="Collation"
            options={COLLATION_OPTIONS}
            value={dbCollation}
            onChange={(e) => setDbCollation(e.target.value)}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowCreateDb(false);
                resetCreateDbForm();
              }}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={createDb.isPending}>
              Create
            </Button>
          </div>
        </form>
      </Modal>

      {/* Drop Database Confirmation Modal */}
      <Modal
        isOpen={!!showDropDb}
        onClose={() => {
          setShowDropDb(null);
          setDropConfirmName('');
        }}
        title="Drop Database"
      >
        <div className="space-y-4">
          <div className="rounded-lg bg-red-50 border border-red-200 p-4">
            <p className="text-sm text-red-800">
              This action is <strong>irreversible</strong>. All data in the
              database <strong>{showDropDb?.name}</strong> will be permanently
              deleted.
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-700 mb-2">
              Type <strong>{showDropDb?.name}</strong> to confirm:
            </p>
            <Input
              id="drop-confirm"
              value={dropConfirmName}
              onChange={(e) => setDropConfirmName(e.target.value)}
              placeholder={showDropDb?.name}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="secondary"
              onClick={() => {
                setShowDropDb(null);
                setDropConfirmName('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={dropConfirmName !== showDropDb?.name}
              isLoading={deleteDb.isPending}
              onClick={handleDropDatabase}
            >
              Drop Database
            </Button>
          </div>
        </div>
      </Modal>

      {/* Create User Modal */}
      <Modal
        isOpen={showCreateUser}
        onClose={() => {
          setShowCreateUser(false);
          resetCreateUserForm();
        }}
        title="Create Database User"
        size="lg"
      >
        <form onSubmit={handleCreateUser} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              id="user-name"
              label="Username"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="db_user"
              required
            />
            <Input
              id="user-password"
              label="Password"
              type="password"
              value={userPassword}
              onChange={(e) => setUserPassword(e.target.value)}
              placeholder="Strong password"
              required
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              id="user-database"
              label="Database (optional)"
              options={databaseSelectOptions}
              value={userDatabaseId}
              onChange={(e) => setUserDatabaseId(e.target.value)}
            />
            <Input
              id="user-host"
              label="Host"
              value={userHost}
              onChange={(e) => setUserHost(e.target.value)}
              placeholder="%"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Privileges
            </label>
            <div className="flex flex-wrap gap-2">
              {PRIVILEGE_OPTIONS.map((priv) => {
                const isSelected = userPrivileges.includes(priv);
                return (
                  <button
                    key={priv}
                    type="button"
                    onClick={() =>
                      togglePrivilege(priv, userPrivileges, setUserPrivileges)
                    }
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      isSelected
                        ? 'bg-blue-100 border-blue-300 text-blue-800'
                        : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {priv}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowCreateUser(false);
                resetCreateUserForm();
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
        isOpen={!!showEditUser}
        onClose={() => {
          setShowEditUser(null);
          setEditPrivileges([]);
        }}
        title={`Edit User: ${showEditUser?.username ?? ''}`}
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Privileges
            </label>
            <div className="flex flex-wrap gap-2">
              {PRIVILEGE_OPTIONS.map((priv) => {
                const isSelected = editPrivileges.includes(priv);
                return (
                  <button
                    key={priv}
                    type="button"
                    onClick={() =>
                      togglePrivilege(priv, editPrivileges, setEditPrivileges)
                    }
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      isSelected
                        ? 'bg-blue-100 border-blue-300 text-blue-800'
                        : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {priv}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="secondary"
              onClick={() => {
                setShowEditUser(null);
                setEditPrivileges([]);
              }}
            >
              Cancel
            </Button>
            <Button isLoading={updateUser.isPending} onClick={handleUpdateUser}>
              Save Changes
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete User Confirmation Modal */}
      <Modal
        isOpen={!!showDeleteUser}
        onClose={() => setShowDeleteUser(null)}
        title="Delete User"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-700">
            Are you sure you want to delete user{' '}
            <strong>{showDeleteUser?.username}</strong>? This action cannot be
            undone.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="secondary"
              onClick={() => setShowDeleteUser(null)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              isLoading={deleteUser.isPending}
              onClick={handleDeleteUser}
            >
              Delete User
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
