import { useEffect, useState } from 'react';
import api from '../lib/api';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  email: string;
  status: string;
  document: string | null;
  subscription?: { planId: string; plan: { name: string } };
  createdAt: string;
}

export function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTenant, setEditingTenant] = useState<any>(null);
  const [form, setForm] = useState({ name: '', slug: '', email: '', document: '', planId: '' });
  const [plans, setPlans] = useState<{ id: string; name: string }[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [error, setError] = useState('');

  const loadTenants = () => {
    setLoading(true);
    api.get('/tenants').then((res) => {
      setTenants(res.data);
      setLoading(false);
    });
  };

  useEffect(() => {
    loadTenants();
    api.get('/plans/active').then((res) => setPlans(res.data));
  }, []);

  const openCreate = () => {
    setEditingTenant(null);
    setForm({ name: '', slug: '', email: '', document: '', planId: '' });
    setShowModal(true);
  };

  const openEdit = (tenant: any) => {
    setEditingTenant(tenant);
    setForm({
      name: tenant.name,
      slug: tenant.slug,
      email: tenant.email,
      document: tenant.document || '',
      planId: tenant.subscription?.planId || '',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError('');
      if (editingTenant) {
        await api.put(`/tenants/${editingTenant.id}`, form);
      } else {
        await api.post('/tenants', form);
      }
      setShowModal(false);
      setEditingTenant(null);
      setForm({ name: '', slug: '', email: '', document: '', planId: '' });
      loadTenants();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Erro ao salvar cliente');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setError('');
      await api.delete(`/tenants/${deleteTarget.id}`);
      setDeleteTarget(null);
      loadTenants();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Erro ao excluir cliente');
    }
  };

  const statusColor: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    trial: 'bg-blue-100 text-blue-700',
    suspended: 'bg-red-100 text-red-700',
    cancelled: 'bg-gray-100 text-gray-500',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Clientes</h1>
          <p className="text-gray-500 text-sm mt-1">
            Gerencie os tenants da plataforma
          </p>
        </div>
        <button
          onClick={openCreate}
          className="px-4 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800 text-sm font-medium"
        >
          + Novo Cliente
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Carregando...</div>
        ) : tenants.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Nenhum cliente cadastrado</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left p-4 font-medium text-gray-600">Nome</th>
                <th className="text-left p-4 font-medium text-gray-600">Email</th>
                <th className="text-left p-4 font-medium text-gray-600">Documento</th>
                <th className="text-left p-4 font-medium text-gray-600">Status</th>
                <th className="text-left p-4 font-medium text-gray-600">Plano</th>
                <th className="text-left p-4 font-medium text-gray-600">Criado em</th>
                <th className="text-right p-4 font-medium text-gray-600">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {tenants.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="p-4">
                    <div className="font-medium text-gray-800">{t.name}</div>
                    <div className="text-gray-400 text-xs">{t.slug}</div>
                  </td>
                  <td className="p-4 text-gray-600">{t.email}</td>
                  <td className="p-4 text-gray-600">{t.document || '-'}</td>
                  <td className="p-4">
                    <span
                      className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${
                        statusColor[t.status] || 'bg-gray-100'
                      }`}
                    >
                      {t.status}
                    </span>
                  </td>
                  <td className="p-4 text-gray-600 text-xs">
                    {t.subscription?.plan?.name || '-'}
                  </td>
                  <td className="p-4 text-gray-500 text-xs">
                    {new Date(t.createdAt).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(t)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Editar">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg>
                      </button>
                      <button onClick={() => setDeleteTarget(t)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Excluir">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md space-y-4"
          >
            <h3 className="text-lg font-bold text-gray-800">{editingTenant ? 'Editar Cliente' : 'Novo Cliente'}</h3>
            {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
              <input
                required
                value={form.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setForm((f: any) => ({
                    ...f,
                    name,
                    slug: editingTenant ? f.slug : name.toLowerCase().replace(/\s+/g, '-').normalize('NFD').replace(/[\u0300-\u036f]/g, ''),
                  }));
                }}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
              <input
                required
                disabled={!!editingTenant}
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Documento</label>
              <input
                value={form.document}
                onChange={(e) => setForm({ ...form, document: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            {!editingTenant && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Plano</label>
                <select
                  required
                  value={form.planId}
                  onChange={(e) => setForm({ ...form, planId: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">Selecione...</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => { setShowModal(false); setEditingTenant(null); }}
                className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 bg-blue-900 text-white rounded-lg text-sm font-medium hover:bg-blue-800"
              >
                {editingTenant ? 'Salvar' : 'Criar'}
              </button>
            </div>
          </form>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold text-gray-800 mb-2">Excluir Cliente</h3>
            <p className="text-sm text-gray-600 mb-4">Tem certeza que deseja excluir o cliente <strong>{deleteTarget.name}</strong>? Esta ação não pode ser desfeita.</p>
            {error && <p className="text-sm text-red-600 mb-4 bg-red-50 p-3 rounded-lg">{error}</p>}
            <div className="flex gap-3">
              <button onClick={() => { setDeleteTarget(null); setError(''); }} className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50">Cancelar</button>
              <button onClick={handleDelete} className="flex-1 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
