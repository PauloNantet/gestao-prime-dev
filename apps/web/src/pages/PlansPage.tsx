import { useEffect, useState } from 'react';
import api from '../lib/api';

interface Plan {
  id: string;
  name: string;
  description: string | null;
  price: number;
  interval: string;
  intervalCount: number;
  features: string[];
  active: boolean;
}

const intervalLabels: Record<string, string> = {
  monthly: 'mensal',
  quarterly: 'trimestral',
  semestral: 'semestral',
  yearly: 'anual',
};

export function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    price: '',
    interval: 'monthly',
    intervalCount: '1',
    features: '',
  });

  const loadPlans = () => {
    setLoading(true);
    api.get('/plans').then((res) => {
      setPlans(res.data);
      setLoading(false);
    });
  };

  useEffect(() => { loadPlans(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post('/plans', {
      ...form,
      price: parseFloat(form.price),
      intervalCount: parseInt(form.intervalCount),
      features: form.features.split('\n').filter(Boolean),
    });
    setShowModal(false);
    setForm({ name: '', description: '', price: '', interval: 'monthly', intervalCount: '1', features: '' });
    loadPlans();
  };

  const handleToggle = async (id: string, active: boolean) => {
    await api.put(`/plans/${id}`, { active: !active });
    loadPlans();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Planos</h1>
          <p className="text-gray-500 text-sm mt-1">
            Gerencie os planos de assinatura
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800 text-sm font-medium"
        >
          + Novo Plano
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full p-8 text-center text-gray-500">Carregando...</div>
        ) : plans.length === 0 ? (
          <div className="col-span-full p-8 text-center text-gray-500">Nenhum plano cadastrado</div>
        ) : (
          plans.map((plan) => (
            <div
              key={plan.id}
              className={`bg-white rounded-xl shadow-sm border p-6 ${
                !plan.active ? 'opacity-60' : ''
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-800">{plan.name}</h3>
                  {plan.description && (
                    <p className="text-sm text-gray-500 mt-1">{plan.description}</p>
                  )}
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={plan.active}
                    onChange={() => handleToggle(plan.id, plan.active)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-900" />
                </label>
              </div>

              <div className="mb-4">
                <span className="text-3xl font-bold text-gray-800">
                  R$ {(plan.price / 100).toFixed(2)}
                </span>
                <span className="text-gray-500 text-sm ml-1">
                  /{plan.intervalCount > 1 ? `${plan.intervalCount} ` : ''}
                  {intervalLabels[plan.interval] || plan.interval}
                </span>
              </div>

              {plan.features.length > 0 && (
                <ul className="space-y-2 text-sm text-gray-600">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className="text-green-500">✓</span> {f}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreate}
            className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg space-y-4"
          >
            <h3 className="text-lg font-bold text-gray-800">Novo Plano</h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                <input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Preço (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Intervalo</label>
                <select
                  value={form.interval}
                  onChange={(e) => setForm({ ...form, interval: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="monthly">Mensal</option>
                  <option value="quarterly">Trimestral</option>
                  <option value="semestral">Semestral</option>
                  <option value="yearly">Anual</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Recursos (um por linha)
                </label>
                <textarea
                  rows={4}
                  value={form.features}
                  onChange={(e) => setForm({ ...form, features: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Suporte prioritário&#10;API ilimitada&#10;10 usuários"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 bg-blue-900 text-white rounded-lg text-sm font-medium hover:bg-blue-800"
              >
                Criar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
