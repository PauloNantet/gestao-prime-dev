import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';

export function ProductsPage() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', slug: '', description: '', githubRepo: '', githubBranch: 'master', icon: '', monthlyPrice: '' });

  const load = () => {
    setLoading(true);
    api.get('/products').then((res) => { setProducts(res.data); setLoading(false); });
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const slug = form.slug || form.name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    await api.post('/products', {
      ...form, slug, monthlyPrice: parseFloat(form.monthlyPrice) || 0,
    });
    setShowModal(false);
    setForm({ name: '', slug: '', description: '', githubRepo: '', githubBranch: 'master', icon: '', monthlyPrice: '' });
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Produtos</h1>
          <p className="text-gray-500 text-sm mt-1">Aplicativos/sistemas vinculados ao GitHub</p>
        </div>
        <button onClick={() => setShowModal(true)} className="px-4 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800 text-sm font-medium">+ Novo Produto</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? <div className="col-span-full p-8 text-center text-gray-500">Carregando...</div>
        : products.length === 0 ? <div className="col-span-full p-8 text-center text-gray-500">Nenhum produto cadastrado</div>
        : products.map((p: any) => (
          <div key={p.id} onClick={() => navigate(`/products/${p.id}/plans`)} className={`bg-white rounded-xl shadow-sm border p-5 cursor-pointer hover:shadow-md transition-shadow ${!p.active ? 'opacity-60' : ''}`}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-bold text-gray-800">{p.icon || '📦'} {p.name}</h3>
                <p className="text-xs text-gray-500 mt-1">{p.githubRepo}</p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full ${p.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{p.active ? 'Ativo' : 'Inativo'}</span>
            </div>
            {p.description && <p className="text-sm text-gray-600 mb-3">{p.description}</p>}
            <div className="text-sm text-gray-500">
              <span className="font-medium text-gray-700">R$ {(p.monthlyPrice / 100).toFixed(2)}</span>/mês base
            </div>
            <div className="text-xs text-gray-400 mt-2">Branch: {p.githubBranch}</div>
            <div className="mt-3 text-xs text-blue-700 font-medium flex items-center gap-1">
              Ver planos →
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleCreate} className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg space-y-4">
            <h3 className="text-lg font-bold text-gray-800">Novo Produto</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
                <input required value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Preço Base (R$)</label>
                <input type="number" step="0.01" value={form.monthlyPrice} onChange={(e) => setForm({ ...form, monthlyPrice: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Repositório GitHub</label>
                <input required value={form.githubRepo} onChange={(e) => setForm({ ...form, githubRepo: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="PauloNantet/logisticagold_dev" />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
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
