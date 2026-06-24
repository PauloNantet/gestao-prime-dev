import { useEffect, useState } from 'react';
import api from '../lib/api';
import { intervalLabels } from '../lib/constants';

export function PlansPage() {
  const [plans, setPlans] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<any>({
    name: '', description: '', price: '', interval: 'monthly', intervalCount: '1', features: '', productIds: [],
  });

  const load = () => {
    setLoading(true);
    Promise.all([api.get('/plans'), api.get('/products/active')]).then(([p, pr]) => {
      setPlans(p.data);
      setProducts(pr.data);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/plans', {
        ...form,
        price: parseFloat(form.price),
        intervalCount: parseInt(form.intervalCount),
        features: form.features.split('\n').filter(Boolean),
      });
      setShowModal(false);
      setForm({ name: '', description: '', price: '', interval: 'monthly', intervalCount: '1', features: '', productIds: [] });
      load();
    } catch {
      alert('Erro ao criar plano');
    }
  };

  const toggleProduct = (id: string) => {
    setForm((f: any) => ({
      ...f,
      productIds: f.productIds.includes(id) ? f.productIds.filter((i: string) => i !== id) : [...f.productIds, id],
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Planos</h1>
          <p className="text-gray-500 text-sm mt-1">Planos de assinatura com múltiplos produtos</p>
        </div>
        <button onClick={() => setShowModal(true)} className="px-4 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800 text-sm font-medium">+ Novo Plano</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? <div className="col-span-full p-8 text-center text-gray-500">Carregando...</div>
        : plans.length === 0 ? <div className="col-span-full p-8 text-center text-gray-500">Nenhum plano</div>
        : plans.map((plan: any) => (
          <div key={plan.id} className={`bg-white rounded-xl shadow-sm border p-6 ${!plan.active ? 'opacity-60' : ''}`}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-800">{plan.name}</h3>
                {plan.description && <p className="text-sm text-gray-500 mt-1">{plan.description}</p>}
              </div>
            </div>
            <div className="mb-4">
              <span className="text-3xl font-bold text-gray-800">R$ {(plan.price / 100).toFixed(2)}</span>
              <span className="text-gray-500 text-sm ml-1">/{plan.intervalCount > 1 ? `${plan.intervalCount} ` : ''}{intervalLabels[plan.interval]}</span>
            </div>

            {plan.products?.length > 0 && (
              <div className="mb-4">
                <p className="text-xs text-gray-500 uppercase font-medium mb-2">Produtos inclusos:</p>
                <div className="flex flex-wrap gap-2">
                  {plan.products.map((pp: any) => (
                    <span key={pp.product.id} className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                      {pp.product.icon || '📦'} {pp.product.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {(() => {
              const features = typeof plan.features === 'string' ? JSON.parse(plan.features) : plan.features;
              return features?.length > 0 ? (
                <ul className="space-y-2 text-sm text-gray-600">
                  {features.map((f: string, i: number) => (
                    <li key={i} className="flex items-center gap-2"><span className="text-green-500">✓</span> {f}</li>
                  ))}
                </ul>
              ) : null;
            })()}
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <form onSubmit={handleCreate} className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg space-y-4 my-8">
            <h3 className="text-lg font-bold text-gray-800">Novo Plano</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Preço (R$)</label>
                <input type="number" step="0.01" required value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Intervalo</label>
                <select value={form.interval} onChange={(e) => setForm({ ...form, interval: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                  <option value="monthly">Mensal</option>
                  <option value="quarterly">Trimestral</option>
                  <option value="semestral">Semestral</option>
                  <option value="yearly">Anual</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Produtos</label>
              {products.length === 0 ? (
                <p className="text-sm text-gray-400">Nenhum produto ativo. Crie produtos primeiro.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {products.map((p: any) => (
                    <label key={p.id} className={`flex items-center gap-2 p-2 border rounded-lg cursor-pointer text-sm ${form.productIds.includes(p.id) ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
                      <input type="checkbox" checked={form.productIds.includes(p.id)} onChange={() => toggleProduct(p.id)} className="sr-only" />
                      <span>{p.icon || '📦'}</span>
                      <span className="flex-1">{p.name}</span>
                      {form.productIds.includes(p.id) && <span className="text-blue-600">✓</span>}
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Recursos (um por linha)</label>
              <textarea rows={3} value={form.features} onChange={(e) => setForm({ ...form, features: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Suporte prioritário&#10;API ilimitada" />
            </div>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50">Cancelar</button>
              <button type="submit" className="flex-1 py-2.5 bg-blue-900 text-white rounded-lg text-sm font-medium hover:bg-blue-800">Criar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
