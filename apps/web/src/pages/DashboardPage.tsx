import { useEffect, useState } from 'react';
import api from '../lib/api';
import { getUser } from '../lib/auth';

interface DashboardStats {
  totalTenants: number;
  totalUsers: number;
  activeSubscriptions: number;
  last24hActions: number;
  totalRevenue?: number;
}

export function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const user = getUser();

  useEffect(() => {
    Promise.all([
      api.get('/monitoring/dashboard'),
      api.get('/billing/revenue').catch(() => ({ data: { totalRevenue: 0 } })),
    ]).then(([dash, revenue]) => {
      setStats({ ...dash.data, totalRevenue: revenue.data.totalRevenue });
    });
  }, []);

  const cards = [
    { label: 'Clientes Ativos', value: stats?.totalTenants ?? '-', color: 'bg-blue-500', icon: '🏢' },
    { label: 'Usuários', value: stats?.totalUsers ?? '-', color: 'bg-green-500', icon: '👤' },
    { label: 'Assinaturas', value: stats?.activeSubscriptions ?? '-', color: 'bg-amber-500', icon: '📋' },
    { label: 'Ações (24h)', value: stats?.last24hActions ?? '-', color: 'bg-purple-500', icon: '📡' },
    { label: 'Receita Total', value: stats?.totalRevenue ? `R$ ${(stats.totalRevenue / 100).toFixed(2)}` : '-', color: 'bg-emerald-500', icon: '💰' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Bem-vindo, {user?.name || 'usuário'}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {cards.map((card) => (
          <div key={card.label} className="bg-white rounded-xl shadow-sm border p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{card.label}</p>
                <p className="text-2xl font-bold text-gray-800 mt-1">{card.value}</p>
              </div>
              <span className="text-2xl">{card.icon}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Fluxo do Sistema</h2>
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
              <span className="w-8 h-8 bg-blue-900 text-white rounded-full flex items-center justify-center text-xs font-bold">1</span>
              <span className="text-gray-700">Cadastre um <strong>produto</strong> (app GitHub)</span>
            </div>
            <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
              <span className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center text-xs font-bold">2</span>
              <span className="text-gray-700">Crie um <strong>plano</strong> com produtos + preço</span>
            </div>
            <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-lg">
              <span className="w-8 h-8 bg-amber-500 text-white rounded-full flex items-center justify-center text-xs font-bold">3</span>
              <span className="text-gray-700">Cliente escolhe plano e <strong>paga</strong></span>
            </div>
            <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg">
              <span className="w-8 h-8 bg-purple-500 text-white rounded-full flex items-center justify-center text-xs font-bold">4</span>
              <span className="text-gray-700">Sistema <strong>deploya</strong> o app no Railway</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Links Rápidos</h2>
          <div className="space-y-3">
            <a href="/products" className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 transition-colors">
              <span className="text-xl">📦</span>
              <div>
                <p className="font-medium text-gray-800 text-sm">Gerenciar Produtos</p>
                <p className="text-xs text-gray-500">Apps vinculados ao GitHub</p>
              </div>
            </a>
            <a href="/plans" className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 transition-colors">
              <span className="text-xl">📋</span>
              <div>
                <p className="font-medium text-gray-800 text-sm">Gerenciar Planos</p>
                <p className="text-xs text-gray-500">Planos com múltiplos produtos</p>
              </div>
            </a>
            <a href="/tenants" className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 transition-colors">
              <span className="text-xl">🏢</span>
              <div>
                <p className="font-medium text-gray-800 text-sm">Ver Clientes</p>
                <p className="text-xs text-gray-500">Todos os tenants cadastrados</p>
              </div>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
