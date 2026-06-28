import { useEffect, useState } from 'react';
import api from '../lib/api';

const VALIDITY_OPTIONS = [30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330, 360];

const emptyForm = {
  name: '',
  dailyRate: '',
  validityDays: '30',
  discount: '',
  productId: '',
  maxUsers: '1',
  hasSupport: false,
  hasUpdates: false,
  unlimitedUsers: false,
};

export function PlansPage() {
  const [plans, setPlans] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<any>(null);
  const [form, setForm] = useState<any>({ ...emptyForm });
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    Promise.all([api.get('/plans'), api.get('/products/active')]).then(([p, pr]) => {
      setPlans(p.data);
      setProducts(pr.data);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditingPlan(null);
    setForm({ ...emptyForm, productId: products[0]?.id || '' });
    setShowModal(true);
  };

  const openEdit = (plan: any) => {
    setEditingPlan(plan);
    setForm({
      name: plan.name,
      dailyRate: (plan.dailyRate / 100).toString(),
      validityDays: (plan.validityDays || 30).toString(),
      discount: (plan.discount || 0).toString(),
      productId: plan.productId,
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
        name: form.name,
        dailyRate: parseFloat(form.dailyRate) || 0,
        validityDays: parseInt(form.validityDays) || 30,
        discount: parseInt(form.discount) || 0,
        maxUsers: form.unlimitedUsers ? 999999 : parseInt(form.maxUsers) || 1,
        hasSupport: !!form.hasSupport,
        hasUpdates: !!form.hasUpdates,
        unlimitedUsers: !!form.unlimitedUsers,
        productId: form.productId,
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

  const handleReorder = async (planId: string, direction: 'up' | 'down') => {
    try {
      await api.put(`/plans/${planId}/reorder`, { direction });
      load();
    } catch {}
  };

  const calcPreview = () => {
    const dailyRate = parseFloat(form.dailyRate) || 0;
    const validityDays = parseInt(form.validityDays) || 30;
    const discount = parseInt(form.discount) || 0;
    const price = dailyRate * validityDays;
    const discountAmount = Math.round(price * (discount / 100));
    const discountedPrice = price - discountAmount;
    return { price, discount, discountAmount, discountedPrice };
  };

  const preview = calcPreview();

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Planos</h1>
          <p className="text-gray-500 text-sm mt-1">Gerencie todos os planos de assinatura</p>
        </div>
        <button onClick={openCreate} className="px-4 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800 text-sm font-medium">+ Novo Plano</button>
      </div>

      {loading ? (
        <div className="p-12 text-center text-gray-500">Carregando...</div>
      ) : plans.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border p-12 text-center text-gray-500">
          Nenhum plano cadastrado. Clique em "+ Novo Plano" para começar.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {plans.map((plan: any, idx: number) => {
            const product = products.find((p: any) => p.id === plan.productId);
            const isPromo = plan.discount > 0;
            return (
              <div
                key={plan.id}
                className={`relative bg-white rounded-2xl border shadow-sm transition-all duration-200 hover:shadow-lg ${
                  !plan.active ? 'opacity-50' : ''
                } ${isPromo ? 'border-emerald-300 shadow-emerald-100' : 'border-gray-200'}`}
              >
                {isPromo && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                    <span className="inline-block bg-emerald-500 text-white text-[11px] font-bold px-4 py-1 rounded-full shadow-sm tracking-wide uppercase">
                      🔥 Promoção -{plan.discount}%
                    </span>
                  </div>
                )}

                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1 min-w-0">
                      {product && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-600 rounded-md text-[11px] font-semibold mb-2">
                          {product.icon || '📦'} {product.name}
                        </span>
                      )}
                      <h3 className="text-lg font-bold text-gray-900 leading-tight">{plan.name}</h3>
                    </div>
                    <div className="flex gap-0.5 shrink-0">
                      <button onClick={() => handleReorder(plan.id, 'up')} disabled={idx === 0} className="p-1 text-gray-300 hover:text-gray-700 disabled:opacity-20 disabled:cursor-not-allowed transition-colors" title="Mover pra cima">
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                      </button>
                      <button onClick={() => handleReorder(plan.id, 'down')} disabled={idx === plans.length - 1} className="p-1 text-gray-300 hover:text-gray-700 disabled:opacity-20 disabled:cursor-not-allowed transition-colors" title="Mover pra baixo">
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                      </button>
                      <button onClick={() => openEdit(plan)} className="p-1 text-gray-300 hover:text-blue-600 transition-colors" title="Editar">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg>
                      </button>
                      <button onClick={() => setDeleteTarget(plan)} className="p-1 text-gray-300 hover:text-red-500 transition-colors" title="Excluir">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                      </button>
                    </div>
                  </div>

                  <div className="mb-5 pb-5 border-b border-gray-100">
                    {isPromo ? (
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <span className="text-gray-400 line-through text-sm font-medium">R$ {(plan.price / 100).toFixed(2)}</span>
                        <span className="text-3xl font-extrabold text-gray-900 tracking-tight">R$ {(plan.discountedPrice / 100).toFixed(2)}</span>
                        <span className="text-gray-500 text-sm">/{plan.validityDays} dias</span>
                      </div>
                    ) : (
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-extrabold text-gray-900 tracking-tight">R$ {(plan.price / 100).toFixed(2)}</span>
                        <span className="text-gray-500 text-sm">/{plan.validityDays} dias</span>
                      </div>
                    )}
                    {plan.savings > 0 && (
                      <p className="text-xs text-emerald-600 font-semibold mt-1.5">
                        <span className="inline-block bg-emerald-50 px-2 py-0.5 rounded">Economia de R$ {(plan.savings / 100).toFixed(2)}</span>
                      </p>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-lg">👥</span>
                      <span className="text-gray-600">{plan.unlimitedUsers || plan.maxUsers >= 999999 ? 'Usuários ilimitados' : `até ${plan.maxUsers} usuário${plan.maxUsers > 1 ? 's' : ''}`}</span>
                    </div>
                    {plan.hasSupport && (
                      <div className="flex items-center gap-3 text-sm">
                        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-green-100 text-green-600 text-xs font-bold">✓</span>
                        <span className="text-gray-600">Suporte Prioritário</span>
                      </div>
                    )}
                    {plan.hasUpdates && (
                      <div className="flex items-center gap-3 text-sm">
                        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-green-100 text-green-600 text-xs font-bold">✓</span>
                        <span className="text-gray-600">Atualizações Garantidas</span>
                      </div>
                    )}
                    {!plan.hasSupport && !plan.hasUpdates && plan.maxUsers <= 1 && (
                      <div className="flex items-center gap-3 text-sm">
                        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-gray-100 text-gray-400 text-xs">—</span>
                        <span className="text-gray-400">Recursos básicos</span>
                      </div>
                    )}
                  </div>

                  {!plan.active && (
                    <div className="mt-4 pt-3 border-t border-gray-100">
                      <span className="inline-block text-xs font-medium text-gray-400 bg-gray-100 px-2 py-1 rounded">Inativo</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg space-y-4 my-8">
            <h3 className="text-lg font-bold text-gray-800">{editingPlan ? 'Editar Plano' : 'Novo Plano'}</h3>
            {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Plano Básico" className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>

            {products.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Produto</label>
                <select required value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                  <option value="">Selecione um produto</option>
                  {products.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.icon || '📦'} {p.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Diária (R$)</label>
                <input type="number" step="0.01" required value={form.dailyRate} onChange={(e) => setForm({ ...form, dailyRate: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Validade (dias)</label>
                <select required value={form.validityDays} onChange={(e) => setForm({ ...form, validityDays: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                  {VALIDITY_OPTIONS.map((d) => (
                    <option key={d} value={d}>{d} dias</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Desconto (%)</label>
              <input type="number" min="0" max="100" value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="0" />
            </div>

            <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
              <div className="flex justify-between"><span className="text-gray-500">Preço:</span><span className="font-medium">R$ {preview.price.toFixed(2)}</span></div>
              {preview.discount > 0 && (
                <>
                  <div className="flex justify-between"><span className="text-gray-500">Desconto ({preview.discount}%):</span><span className="font-medium text-red-600">-R$ {preview.discountAmount.toFixed(2)}</span></div>
                  <div className="flex justify-between border-t pt-1"><span className="text-gray-700 font-medium">Preço final:</span><span className="font-bold text-emerald-700">R$ {preview.discountedPrice.toFixed(2)}</span></div>
                </>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Máx. Usuários</label>
              <input type="number" min="1" value={form.maxUsers} disabled={form.unlimitedUsers} onChange={(e) => setForm({ ...form, maxUsers: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100 disabled:cursor-not-allowed" />
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
