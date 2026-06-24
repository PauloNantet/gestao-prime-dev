import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { intervalLabels } from '../lib/constants';

const emptyForm = {
  name: '', description: '', price: '', interval: 'monthly' as string,
  intervalCount: '1', productIds: [] as string[],
  maxUsers: '1', hasSupport: false, hasUpdates: false, unlimitedUsers: false,
};

export function ProductPlansPage() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<any>(null);
  const [form, setForm] = useState<any>({ ...emptyForm });
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [error, setError] = useState('');

  const load = () => {
    if (!productId) return;
    setLoading(true);
    Promise.all([
      api.get(`/products/${productId}`),
      api.get(`/plans?productId=${productId}`),
    ]).then(([p, pl]) => {
      setProduct(p.data);
      setPlans(pl.data);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, [productId]);

  const openCreate = () => {
    setEditingPlan(null);
    setForm({ ...emptyForm, productIds: [productId!] });
    setShowModal(true);
  };

  const openEdit = (plan: any) => {
    setEditingPlan(plan);
    setForm({
      name: plan.name,
      description: plan.description || '',
      price: (plan.price / 100).toString(),
      interval: plan.interval,
      intervalCount: plan.intervalCount.toString(),
      productIds: plan.products?.map((pp: any) => pp.product.id) || [productId!],
      maxUsers: (plan.maxUsers || 1).toString(),
      hasSupport: plan.hasSupport ?? false,
      hasUpdates: plan.hasUpdates ?? false,
      unlimitedUsers: plan.maxUsers >= 999999,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError('');
      const payload = {
        ...form,
        price: parseFloat(form.price),
        intervalCount: parseInt(form.intervalCount),
        features: [],
        maxUsers: form.unlimitedUsers ? 999999 : parseInt(form.maxUsers) || 1,
        hasSupport: !!form.hasSupport,
        hasUpdates: !!form.hasUpdates,
      };

      if (editingPlan) {
        await api.put(`/plans/${editingPlan.id}`, payload);
      } else {
        await api.post('/plans', payload);
      }

      setShowModal(false);
      setEditingPlan(null);
      setForm({ ...emptyForm });
      load();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Erro ao salvar plano');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setError('');
      await api.delete(`/plans/${deleteTarget.id}`);
      setDeleteTarget(null);
      load();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Erro ao excluir plano');
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Carregando...</div>;
  }

  if (!product) {
    return (
      <div className="p-8 text-center text-gray-500">
        Produto não encontrado.{' '}
        <button onClick={() => navigate('/products')} className="text-blue-700 underline">Voltar</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <button onClick={() => navigate('/products')} className="text-sm text-blue-700 hover:underline mb-1 inline-flex items-center gap-1">
            ← Voltar para Produtos
          </button>
          <h1 className="text-2xl font-bold text-gray-800">
            {product.icon || '📦'} {product.name}
          </h1>
          <p className="text-gray-500 text-sm mt-1">{product.description || 'Sem descrição'}</p>
        </div>
        <button onClick={openCreate} className="px-4 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800 text-sm font-medium">
          + Novo Plano
        </button>
      </div>

      {plans.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border p-12 text-center text-gray-500">
          Nenhum plano cadastrado para este produto. Clique em "+ Novo Plano" para começar.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map((plan: any) => (
            <div key={plan.id} className={`bg-white rounded-xl shadow-sm border p-6 ${!plan.active ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-800">{plan.name}</h3>
                  {plan.description && <p className="text-sm text-gray-500 mt-1">{plan.description}</p>}
                </div>
                <div className="flex gap-1 ml-2">
                  <button onClick={() => openEdit(plan)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Editar">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg>
                  </button>
                  <button onClick={() => setDeleteTarget(plan)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Excluir">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                  </button>
                </div>
              </div>

              <div className="mb-4">
                <span className="text-3xl font-bold text-gray-800">R$ {(plan.price / 100).toFixed(2)}</span>
                <span className="text-gray-500 text-sm ml-1">/{plan.intervalCount > 1 ? `${plan.intervalCount} ` : ''}{intervalLabels[plan.interval]}</span>
                {plan.savings ? <span className="block text-xs text-emerald-600 font-medium mt-1">Economia de {plan.savings}</span> : null}
              </div>

              <div className="flex flex-wrap gap-3 text-xs text-gray-500 mb-3">
                <span>👥 {plan.unlimitedUsers || plan.maxUsers >= 999999 ? 'Ilimitados' : `${plan.maxUsers} usuários`}</span>
                {plan.hasSupport && <span>✅ Suporte</span>}
                {plan.hasUpdates && <span>🔄 Atualizações</span>}
              </div>

              {plan.products?.length > 0 && (
                <div className="pt-3 border-t border-gray-100">
                  <p className="text-xs text-gray-500 uppercase font-medium mb-2">Produtos inclusos:</p>
                  <div className="flex flex-wrap gap-2">
                    {plan.products.map((pp: any) => (
                      <span key={pp.product.id} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${pp.product.id === productId ? 'bg-blue-50 text-blue-700' : 'bg-gray-50 text-gray-600'}`}>
                        {pp.product.icon || '📦'} {pp.product.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg space-y-4 my-8">
            <h3 className="text-lg font-bold text-gray-800">{editingPlan ? 'Editar Plano' : 'Novo Plano'}</h3>
            {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div className="grid grid-cols-3 gap-4">
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max. User</label>
                <input type="number" min="1" value={form.maxUsers} disabled={form.unlimitedUsers} onChange={(e) => setForm({ ...form, maxUsers: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100 disabled:cursor-not-allowed" />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.unlimitedUsers} onChange={(e) => setForm({ ...form, unlimitedUsers: e.target.checked })} className="rounded border-gray-300 text-blue-900 focus:ring-blue-500" />
                <span className="text-sm font-medium text-gray-700">Usuários ilimitados</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.hasSupport} onChange={(e) => setForm({ ...form, hasSupport: e.target.checked })} className="rounded border-gray-300 text-blue-900 focus:ring-blue-500" />
                <span className="text-sm font-medium text-gray-700">Suporte</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.hasUpdates} onChange={(e) => setForm({ ...form, hasUpdates: e.target.checked })} className="rounded border-gray-300 text-blue-900 focus:ring-blue-500" />
                <span className="text-sm font-medium text-gray-700">Atualizações</span>
              </label>
            </div>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => { setShowModal(false); setEditingPlan(null); }} className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50">Cancelar</button>
              <button type="submit" className="flex-1 py-2.5 bg-blue-900 text-white rounded-lg text-sm font-medium hover:bg-blue-800">{editingPlan ? 'Salvar' : 'Criar'}</button>
            </div>
          </form>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold text-gray-800 mb-2">Excluir Plano</h3>
            <p className="text-sm text-gray-600 mb-4">Tem certeza que deseja excluir o plano <strong>{deleteTarget.name}</strong>? Esta ação não pode ser desfeita.</p>
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
