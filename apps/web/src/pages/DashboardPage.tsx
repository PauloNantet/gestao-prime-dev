import { useEffect, useState } from 'react';
import api from '../lib/api';
import { getUser } from '../lib/auth';

interface DashboardStats {
  totalTenants: number;
  totalUsers: number;
  activeSubscriptions: number;
  last24hActions: number;
}

export function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const user = getUser();

  useEffect(() => {
    api.get('/monitoring/dashboard').then((res) => setStats(res.data));
  }, []);

  const cards = [
    { label: 'Clientes Ativos', value: stats?.totalTenants ?? '-', color: 'bg-blue-500' },
    { label: 'Usuários', value: stats?.totalUsers ?? '-', color: 'bg-green-500' },
    { label: 'Assinaturas Ativas', value: stats?.activeSubscriptions ?? '-', color: 'bg-amber-500' },
    { label: 'Ações (24h)', value: stats?.last24hActions ?? '-', color: 'bg-purple-500' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">
          Bem-vindo, {user?.name || 'usuário'}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div key={card.label} className="bg-white rounded-xl shadow-sm border p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{card.label}</p>
                <p className="text-3xl font-bold text-gray-800 mt-1">{card.value}</p>
              </div>
              <div className={`w-12 h-12 ${card.color} rounded-lg opacity-20`} />
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">
          Resumo do Sistema
        </h2>
        <p className="text-gray-600 text-sm leading-relaxed">
          Gestão Prime é uma plataforma SaaS multi-empresa. Cada cliente (tenant)
          possui seu próprio banco de dados isolado, planos de assinatura
          personalizados e monitoramento completo de atividades.
        </p>
      </div>
    </div>
  );
}
