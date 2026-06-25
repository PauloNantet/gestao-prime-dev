import { useEffect, useState } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import api from '../lib/api';

interface ActivityLog {
  id: string;
  user_id: number;
  user_name: string;
  action: string;
  entity: string;
  entity_id: string;
  description: string;
  ip: string;
  created_at: string;
}

interface Tenant {
  id: string;
  name: string;
  slug: string;
}

export function MonitoringPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenant, setSelectedTenant] = useState('');
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    api.get('/tenants').then((res) => setTenants(res.data));
  }, []);

  useEffect(() => {
    if (!selectedTenant) return;
    setPage(1);
    loadLogs(selectedTenant, 1);
  }, [selectedTenant]);

  const loadLogs = (tenantId: string, p: number, from?: string, to?: string) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), limit: '20' });
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    api
      .get(`/monitoring/logs/${tenantId}?${params.toString()}`)
      .then((res) => {
        setLogs(res.data.logs);
        setTotalPages(res.data.totalPages);
      })
      .finally(() => setLoading(false));
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    loadLogs(selectedTenant, newPage, dateFrom, dateTo);
  };

  const handleFilter = () => {
    setPage(1);
    loadLogs(selectedTenant, 1, dateFrom, dateTo);
  };

  const handleDownloadPDF = async () => {
    if (!selectedTenant) return;
    setDownloading(true);

    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set('from', dateFrom);
      if (dateTo) params.set('to', dateTo);

      const res = await api.get(`/monitoring/logs/${selectedTenant}/export?${params.toString()}`);
      const { tenantName, logs: exportLogs } = res.data;

      const doc = new jsPDF({ orientation: 'landscape' });

      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Relatorio de Monitoramento', 14, 15);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Cliente: ${tenantName}`, 14, 23);

      const periodParts: string[] = [];
      if (dateFrom) periodParts.push(`De: ${dateFrom.split('-').reverse().join('/')}`);
      if (dateTo) periodParts.push(`Ate: ${dateTo.split('-').reverse().join('/')}`);
      if (periodParts.length > 0) {
        doc.text(periodParts.join('  |  '), 14, 29);
      }

      const now = new Date().toLocaleString('pt-BR');
      doc.text(`Gerado em: ${now}`, 14, 35);

      doc.text(`Total: ${exportLogs.length} registro(s)`, 14, 41);

      const actionLabels: Record<string, string> = {
        login: 'Login',
        create: 'Criacao',
        update: 'Atualizacao',
        delete: 'Exclusao',
      };

      const tableData = exportLogs.map((log: ActivityLog) => [
        new Date(log.created_at).toLocaleString('pt-BR'),
        log.user_name,
        actionLabels[log.action] || log.action,
        log.entity,
        log.entity_id || '-',
        log.description,
        log.ip || '-',
      ]);

      autoTable(doc, {
        startY: 47,
        head: [['Data/Hora', 'Usuario', 'Acao', 'Entidade', 'ID', 'Descricao', 'IP']],
        body: tableData,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [59, 130, 246] },
        alternateRowStyles: { fillColor: [243, 244, 246] },
        margin: { left: 14 },
      });

      const fileName = `monitoramento_${tenantName.replace(/\s+/g, '_')}_${dateFrom || 'todos'}_${dateTo || 'todos'}.pdf`;
      doc.save(fileName);
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
    } finally {
      setDownloading(false);
    }
  };

  const actionColors: Record<string, string> = {
    login: 'text-green-600 bg-green-50',
    create: 'text-blue-600 bg-blue-50',
    update: 'text-amber-600 bg-amber-50',
    delete: 'text-red-600 bg-red-50',
  };

  const actionIcons: Record<string, string> = {
    login: '🔑',
    create: '➕',
    update: '✏️',
    delete: '🗑️',
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
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Selecione um cliente
            </label>
            <select
              value={selectedTenant}
              onChange={(e) => setSelectedTenant(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">-- Selecione --</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.slug})
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[150px]">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Data inicial
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div className="min-w-[150px]">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Data final
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <button
            onClick={handleFilter}
            disabled={!selectedTenant}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Filtrar
          </button>
          <button
            onClick={handleDownloadPDF}
            disabled={!selectedTenant || downloading}
            className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {downloading ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Gerando...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Baixar PDF
              </>
            )}
          </button>
        </div>
      </div>

      {selectedTenant && (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Carregando...</div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center text-gray-500">Nenhum registro encontrado</div>
          ) : (
            <>
              <div className="divide-y">
                {logs.map((log) => (
                  <div key={log.id} className="p-4 flex items-start gap-4 hover:bg-gray-50">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg">
                      {actionIcons[log.action] || '📋'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            actionColors[log.action] || 'text-gray-600 bg-gray-50'
                          }`}
                        >
                          {log.action.toUpperCase()}
                        </span>
                        <span className="text-sm text-gray-800 font-medium">
                          {log.entity}
                        </span>
                        {log.entity_id && (
                          <span className="text-xs text-gray-400">#{log.entity_id}</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{log.description}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        por <span className="font-medium">{log.user_name}</span>
                        {log.ip && ` • IP: ${log.ip}`}
                      </p>
                    </div>
                    <span className="text-xs text-gray-400 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString('pt-BR')}
                    </span>
                  </div>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="p-4 border-t flex items-center justify-between">
                  <span className="text-sm text-gray-500">
                    Pagina {page} de {totalPages}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handlePageChange(page - 1)}
                      disabled={page === 1}
                      className="px-3 py-1 text-sm border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      Anterior
                    </button>
                    <button
                      onClick={() => handlePageChange(page + 1)}
                      disabled={page === totalPages}
                      className="px-3 py-1 text-sm border rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      Proxima
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
