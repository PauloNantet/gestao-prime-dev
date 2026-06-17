import { useEffect, useState } from 'react';
import api from '../lib/api';

interface AuditLog {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  metadata: unknown;
  ip: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string };
}

interface Tenant {
  id: string;
  name: string;
  slug: string;
}

export function MonitoringPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenant, setSelectedTenant] = useState('');
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/tenants').then((res) => setTenants(res.data));
  }, []);

  useEffect(() => {
    if (!selectedTenant) return;
    setLoading(true);
    api
      .get(`/monitoring/logs/${selectedTenant}`)
      .then((res) => setLogs(res.data.logs))
      .finally(() => setLoading(false));
  }, [selectedTenant]);

  const actionColors: Record<string, string> = {
    login: 'text-green-600',
    logout: 'text-gray-600',
    create: 'text-blue-600',
    update: 'text-amber-600',
    delete: 'text-red-600',
    payment: 'text-purple-600',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Monitoramento</h1>
        <p className="text-gray-500 text-sm mt-1">
          Acompanhe as atividades dos clientes
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border p-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Selecione um cliente
        </label>
        <select
          value={selectedTenant}
          onChange={(e) => setSelectedTenant(e.target.value)}
          className="w-full max-w-md px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
        >
          <option value="">-- Selecione --</option>
          {tenants.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.slug})
            </option>
          ))}
        </select>
      </div>

      {selectedTenant && (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Carregando...</div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center text-gray-500">Nenhum registro encontrado</div>
          ) : (
            <div className="divide-y">
              {logs.map((log) => (
                <div key={log.id} className="p-4 flex items-start gap-4 hover:bg-gray-50">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-medium uppercase ${
                          actionColors[log.action] || 'text-gray-500'
                        }`}
                      >
                        {log.action}
                      </span>
                      <span className="text-sm text-gray-800 font-medium">
                        {log.entity}
                      </span>
                      {log.entityId && (
                        <span className="text-xs text-gray-400">#{log.entityId.slice(0, 8)}</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      por <span className="font-medium">{log.user.name}</span>
                      {log.ip && ` • IP: ${log.ip}`}
                    </p>
                  </div>
                  <span className="text-xs text-gray-400 whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString('pt-BR')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
