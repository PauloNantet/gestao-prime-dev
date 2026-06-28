import { useEffect, useState } from 'react';
import api from '../lib/api';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  email: string;
  status: string;
  document: string | null;
  subscription?: { planId: string; planName: string; endsAt: string; status: string };
  products?: { id: string; name: string; icon: string | null }[];
  createdAt: string;
  settings: Record<string, any>;
  additionalDays: number;
}

interface RailwayProject {
  id: string; name: string;
}
interface Environment {
  id: string; name: string;
}
interface ProjectDatabase {
  projectId: string; environmentId: string; projectName: string; environmentName: string; databaseUrl: string;
}

function computeDaysRemaining(endsAt: string): number {
  const end = new Date(endsAt);
  const now = new Date();
  const diff = end.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function getEndDate(tenant: any): string | null {
  if (tenant.subscription?.endsAt) return tenant.subscription.endsAt;
  if (tenant.additionalDays && tenant.createdAt) {
    const d = new Date(tenant.createdAt);
    d.setDate(d.getDate() + Number(tenant.additionalDays));
    return d.toISOString();
  }
  return null;
}

export function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTenant, setEditingTenant] = useState<any>(null);
  const [form, setForm] = useState({ name: '', slug: '', email: '', document: '', planId: '', status: 'active', projectId: '', environmentId: '', databaseUrl: '', additionalDays: 0 });
  const [plans, setPlans] = useState<{ id: string; name: string }[]>([]);
  const [isTrial, setIsTrial] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [error, setError] = useState('');

  const [projects, setProjects] = useState<RailwayProject[]>([]);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [loadingEnvs, setLoadingEnvs] = useState(false);
  const [savedDbs, setSavedDbs] = useState<Record<string, ProjectDatabase>>({});

  const [dbTenant, setDbTenant] = useState<any>(null);
  const [dbTables, setDbTables] = useState<string[]>([]);
  const [dbData, setDbData] = useState<any[]>([]);
  const [dbTableName, setDbTableName] = useState<string | null>(null);
  const [dbColumns, setDbColumns] = useState<any[]>([]);
  const [dbPrimaryKey, setDbPrimaryKey] = useState<string | null>(null);
  const [dbLoading, setDbLoading] = useState(false);
  const [dbShowForm, setDbShowForm] = useState(false);
  const [dbEditingRow, setDbEditingRow] = useState<any | null>(null);
  const [dbFormData, setDbFormData] = useState<Record<string, string>>({});
  const [dbSaving, setDbSaving] = useState(false);

  const loadTenants = () => {
    setLoading(true);
    api.get('/tenants').then((res) => {
      setTenants(res.data);
      setLoading(false);
    });
  };

  useEffect(() => {
    loadTenants();
    api.get('/plans').then((res) => setPlans(res.data)).catch(() => {});
    api.get('/deploy/railway/projects').then((res) => setProjects(res.data)).catch(() => {});
    api.get('/deploy/project-databases').then((res) => {
      const map: Record<string, ProjectDatabase> = {};
      for (const db of res.data) map[`${db.projectId}:${db.environmentId}`] = db;
      setSavedDbs(map);
    }).catch(() => {});
  }, []);



  useEffect(() => {
    if (form.projectId) {
      setLoadingEnvs(true);
      setForm((f: any) => ({ ...f, environmentId: '', databaseUrl: '' }));
      api.get(`/deploy/railway/projects/${form.projectId}/environments`).then((res) => {
        setEnvironments(res.data);
        setLoadingEnvs(false);
      }).catch(() => setLoadingEnvs(false));
    } else {
      setEnvironments([]);
    }
  }, [form.projectId]);

  useEffect(() => {
    if (form.projectId && form.environmentId) {
      const saved = savedDbs[`${form.projectId}:${form.environmentId}`];
      setForm((f: any) => ({ ...f, databaseUrl: saved?.databaseUrl || '' }));
    }
  }, [form.environmentId, savedDbs, form.projectId]);

  const openCreate = () => {
    setEditingTenant(null);
    setIsTrial(false);
    setForm({ name: '', slug: '', email: '', document: '', planId: '', status: 'active', projectId: '', environmentId: '', databaseUrl: '', additionalDays: 0 });
    setShowModal(true);
  };

  const openEdit = (tenant: any) => {
    setEditingTenant(tenant);
    const settings = tenant.settings || {};
    const trial = tenant.status === 'trial';
    setIsTrial(trial);
    setForm({
      name: tenant.name,
      slug: tenant.slug,
      email: tenant.email,
      document: tenant.document || '',
      planId: trial ? '' : (tenant.subscription?.planId || ''),
      status: tenant.status || 'active',
      projectId: settings.railwayProjectId || '',
      environmentId: settings.railwayEnvironmentId || '',
      databaseUrl: settings.railwayDatabaseUrl || '',
      additionalDays: tenant.additionalDays ?? 0,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError('');
      const { slug, planId, projectId, environmentId, databaseUrl, ...payload } = form;

      const settings: Record<string, any> = {};
      if (projectId) settings.railwayProjectId = projectId;
      if (environmentId) settings.railwayEnvironmentId = environmentId;
      if (databaseUrl) settings.railwayDatabaseUrl = databaseUrl;

      if (editingTenant) {
        await api.put(`/tenants/${editingTenant.id}`, {
          ...payload,
          planId: planId || undefined,
          ...(Object.keys(settings).length ? { settings } : {}),
        });
      } else {
        const tenant = await api.post('/tenants', {
          ...payload, slug, planId,
          ...(Object.keys(settings).length ? { settings } : {}),
        });
        if (projectId && environmentId && databaseUrl) {
          await api.post('/deploy/project-databases', {
            projectId, environmentId,
            projectName: projects.find(p => p.id === projectId)?.name || '',
            environmentName: environments.find(e => e.id === environmentId)?.name || '',
            databaseUrl,
          });
        }
      }
      setShowModal(false);
      setEditingTenant(null);
      setIsTrial(false);
      setForm({ name: '', slug: '', email: '', document: '', planId: '', status: 'active', projectId: '', environmentId: '', databaseUrl: '', additionalDays: 0 });
      loadTenants();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Erro ao salvar cliente');
    }
  };

  function getDbUrl(tenant: any): string | null {
    return tenant.settings?.railwayDatabaseUrl || null;
  }

  async function openDbBrowser(tenant: any) {
    const dbUrl = getDbUrl(tenant);
    if (!dbUrl) { alert('Este cliente nao possui uma Database URL configurada.'); return; }
    setDbTenant(tenant);
    setDbTables([]);
    setDbData([]);
    setDbTableName(null);
    setDbShowForm(false);
    setDbLoading(true);
    try {
      const res = await api.post('/deploy/direct-query', { databaseUrl: dbUrl });
      setDbTables(res.data.tables);
    } catch { }
    setDbLoading(false);
  }

  async function handleDbSelectTable(tableName: string) {
    const dbUrl = getDbUrl(dbTenant);
    if (!dbUrl) return;
    setDbTableName(tableName);
    setDbShowForm(false);
    setDbEditingRow(null);
    setDbLoading(true);
    try {
      const [queryRes, colsRes] = await Promise.all([
        api.post('/deploy/direct-query', { databaseUrl: dbUrl, table: tableName }),
        api.post('/deploy/direct-columns', { databaseUrl: dbUrl, table: tableName }),
      ]);
      setDbData(queryRes.data.data);
      setDbColumns(colsRes.data.columns);
      setDbPrimaryKey(colsRes.data.primaryKey);
    } catch { }
    setDbLoading(false);
  }

  function openDbInsert() {
    setDbEditingRow(null);
    const empty: Record<string, string> = {};
    for (const col of dbColumns) empty[col.name] = '';
    setDbFormData(empty);
    setDbShowForm(true);
  }

  function openDbEdit(row: any) {
    setDbEditingRow(row);
    const data: Record<string, string> = {};
    for (const col of dbColumns) data[col.name] = row[col.name] === null ? '' : String(row[col.name]);
    setDbFormData(data);
    setDbShowForm(true);
  }

  async function handleDbSave() {
    const dbUrl = getDbUrl(dbTenant);
    if (!dbUrl || !dbTableName) return;
    setDbSaving(true);
    try {
      const payload: Record<string, any> = {};
      for (const col of dbColumns) {
        const val = dbFormData[col.name];
        if (val === '') continue;
        if (col.type === 'integer' || col.type === 'bigint') payload[col.name] = parseInt(val, 10);
        else if (col.type === 'numeric' || col.type === 'real') payload[col.name] = parseFloat(val);
        else if (col.type === 'boolean') payload[col.name] = val === 'true' || val === '1';
        else payload[col.name] = val;
      }

      if (dbEditingRow && dbPrimaryKey) {
        await api.put('/deploy/direct-update', {
          databaseUrl: dbUrl, table: dbTableName,
          idColumn: dbPrimaryKey, idValue: dbEditingRow[dbPrimaryKey],
          data: payload,
        });
      } else {
        await api.post('/deploy/direct-insert', {
          databaseUrl: dbUrl, table: dbTableName, data: payload,
        });
      }
      setDbShowForm(false);
      setDbEditingRow(null);
      await handleDbSelectTable(dbTableName);
    } catch { }
    setDbSaving(false);
  }

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
    inactive: 'bg-gray-100 text-gray-500',
    trial: 'bg-blue-100 text-blue-700',
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
                <th className="text-left p-4 font-medium text-gray-600">Produtos</th>
                <th className="text-left p-4 font-medium text-gray-600">Plano</th>
                <th className="text-left p-4 font-medium text-gray-600">Encerra em</th>
                <th className="text-left p-4 font-medium text-gray-600">Dias restantes</th>
                <th className="text-left p-4 font-medium text-gray-600">Criado em</th>
                <th className="text-right p-4 font-medium text-gray-600">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {tenants.map((t) => {
                const endDate = getEndDate(t);
                const daysRemaining = endDate ? computeDaysRemaining(endDate) : null;
                return (
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
                  <td className="p-4">
                    <div className="flex flex-wrap gap-1">
                      {t.products?.length ? t.products.map((p: any) => (
                        <span key={p.id} className="inline-block px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                          {p.name}
                        </span>
                      )) : <span className="text-gray-400 text-xs">-</span>}
                    </div>
                  </td>
                  <td className="p-4 text-gray-600 text-xs">
                    {t.status === 'trial' ? 'Trial' : (t.subscription?.planName || '-')}
                  </td>
                  <td className="p-4 text-gray-600 text-xs">
                    {getEndDate(t)
                      ? new Date(getEndDate(t)!).toLocaleDateString('pt-BR')
                      : '-'}
                  </td>
                  <td className="p-4 text-xs">
                    {t.status === 'trial' ? (
                      <span className="font-medium text-blue-600">
                        {t.additionalDays || 0} dias adicional(is)
                      </span>
                    ) : daysRemaining != null ? (
                      <span className={`font-medium ${
                        daysRemaining <= 3 ? 'text-red-600' :
                        daysRemaining <= 7 ? 'text-amber-600' :
                        'text-green-600'
                      }`}>
                        {daysRemaining} dia(s)
                      </span>
                    ) : '-'}
                  </td>
                  <td className="p-4 text-gray-500 text-xs">
                    {new Date(t.createdAt).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openDbBrowser(t)} className="px-2 py-1 text-xs bg-emerald-700 text-white rounded hover:bg-emerald-600 transition-colors" title="Ver dados do banco">
                        Banco
                      </button>
                      <button onClick={() => openEdit(t)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Editar">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg>
                      </button>
                      <button onClick={() => setDeleteTarget(t)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Excluir">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md space-y-4 max-h-[90vh] overflow-y-auto"
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
                    slug: name.toLowerCase().replace(/\s+/g, '-').normalize('NFD').replace(/[\u0300-\u036f]/g, ''),
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                disabled={isTrial}
              >
                <option value="active">Ativo</option>
                <option value="inactive">Inativo</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Dias Adicionais</label>
              <input
                type="number"
                min="0"
                value={form.additionalDays}
                onChange={(e) => setForm({ ...form, additionalDays: Math.max(0, parseInt(e.target.value) || 0) })}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <p className="text-xs text-gray-400 mt-1">Dias extras para ajustar o vencimento do plano</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Projeto Railway</label>
              <select
                value={form.projectId}
                onChange={(e) => setForm({ ...form, projectId: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">Selecione...</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            {form.projectId && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ambiente</label>
                <select
                  value={form.environmentId}
                  onChange={(e) => setForm({ ...form, environmentId: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="">Selecione...</option>
                  {loadingEnvs ? <option disabled>Carregando...</option>
                  : environments.map((e) => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
              </div>
            )}
            {form.projectId && form.environmentId && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Database URL</label>
                <input
                  type="text"
                  value={form.databaseUrl}
                  onChange={(e) => setForm({ ...form, databaseUrl: e.target.value })}
                  placeholder="postgresql://user:pass@host:5432/dbname"
                  className="w-full px-3 py-2 border rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            )}

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <input
                  type="checkbox"
                  checked={isTrial}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setIsTrial(checked);
                    if (checked) {
                      setForm((f: any) => ({ ...f, status: 'trial', planId: '' }));
                    } else {
                      setForm((f: any) => ({ ...f, status: f.status === 'trial' ? 'active' : f.status }));
                    }
                  }}
                  className="rounded border-gray-300 text-blue-900 focus:ring-blue-500"
                />
                Trial (sem plano, usa dias avulsos)
              </label>
              <select
                required={!isTrial}
                value={form.planId}
                disabled={isTrial}
                onChange={(e) => setForm({ ...form, planId: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                <option value="">{isTrial ? 'Trial — sem plano' : 'Selecione...'}</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

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

      {dbTenant && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-bold text-gray-800">Banco de dados — {dbTenant.name}</h3>
              <button onClick={() => { setDbTenant(null); setDbTables([]); }}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/></svg>
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 space-y-4">
              {dbLoading ? (
                <div className="text-center text-gray-500 py-8">Carregando...</div>
              ) : (
                <>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Tabelas</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {dbTables.map((t) => (
                        <button key={t} onClick={() => handleDbSelectTable(t)}
                          className={`text-xs px-2.5 py-1.5 rounded font-medium transition-colors ${
                            dbTableName === t ? 'bg-blue-900 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          }`}>{t}</button>
                      ))}
                    </div>
                  </div>
                  {dbData.length > 0 && dbTableName && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-semibold text-gray-700">Dados de: {dbTableName}</h4>
                        <button onClick={openDbInsert} className="px-3 py-1.5 bg-blue-900 text-white rounded-lg text-xs hover:bg-blue-800">+ Inserir</button>
                      </div>
                      <div className="bg-white rounded-lg border overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-100 border-b">
                              {Object.keys(dbData[0]).map((col) => (
                                <th key={col} className="text-left px-3 py-2 font-medium text-gray-600 whitespace-nowrap">{col}</th>
                              ))}
                              <th className="px-3 py-2 font-medium text-gray-600 w-16">Acoes</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {dbData.map((row: any, i: number) => (
                              <tr key={i} className="hover:bg-gray-50">
                                {Object.keys(dbData[0]).map((col) => (
                                  <td key={col} className="px-3 py-2 text-gray-700 whitespace-nowrap max-w-xs truncate">
                                    {row[col] === null ? <span className="text-gray-400">NULL</span> : String(row[col])}
                                  </td>
                                ))}
                                <td className="px-3 py-2">
                                  <button onClick={() => openDbEdit(row)} className="text-xs text-blue-700 hover:text-blue-900 font-medium">Editar</button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                  {dbShowForm && (
                    <div className="bg-white rounded-lg border p-4 space-y-3">
                      <h5 className="text-sm font-semibold text-gray-700">{dbEditingRow ? 'Editar registro' : 'Inserir novo registro'}</h5>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {dbColumns.map((col: any) => (
                          <div key={col.name}>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              {col.name} <span className="text-gray-400">({col.type})</span>
                              {!col.nullable && <span className="text-red-500 ml-1">*</span>}
                            </label>
                            <input type="text" value={dbFormData[col.name] || ''}
                              onChange={(e) => setDbFormData((p: any) => ({ ...p, [col.name]: e.target.value }))}
                              placeholder={col.nullable ? 'NULL' : 'obrigatorio'}
                              disabled={col.name === dbPrimaryKey && !!dbEditingRow}
                              className="w-full px-2.5 py-1.5 border rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100" />
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2 pt-2">
                        <button onClick={handleDbSave} disabled={dbSaving}
                          className="px-4 py-2 bg-blue-900 text-white rounded-lg text-sm hover:bg-blue-800 disabled:opacity-50">
                          {dbSaving ? 'Salvando...' : 'Salvar'}
                        </button>
                        <button onClick={() => { setDbShowForm(false); setDbEditingRow(null); }}
                          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-300">Cancelar</button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold text-gray-800 mb-2">Excluir Cliente</h3>
            <p className="text-sm text-gray-600 mb-4">Tem certeza que deseja excluir o cliente <strong>{deleteTarget.name}</strong>? Esta acao nao pode ser desfeita.</p>
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
