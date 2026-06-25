import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';

export function ProductsPage() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm] = useState({ name: '', slug: '', description: '', icon: '', projectId: '', basePrice: '' });

  const load = () => {
    setLoading(true);
    api.get('/products').then((res) => { setProducts(res.data); setLoading(false); });
  };

  useEffect(() => { load(); api.get('/deploy/railway/projects').then((res) => setProjects(res.data)).catch(() => {}); }, []);

  const openNew = () => {
    setEditingProduct(null);
    setForm({ name: '', slug: '', description: '', icon: '', projectId: '', basePrice: '' });
    setShowModal(true);
  };

  const openEdit = (e: React.MouseEvent, product: any) => {
    e.stopPropagation();
    setEditingProduct(product);
    setForm({
      name: product.name,
      slug: product.slug,
      description: product.description || '',
      icon: product.icon || '',
      projectId: product.projectId || '',
      basePrice: product.basePrice ? (product.basePrice / 100).toString() : '',
    });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const slug = form.slug || form.name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const payload: any = { ...form, slug, basePrice: form.basePrice ? parseFloat(form.basePrice) : undefined };
    if (!payload.projectId) delete payload.projectId;
    if (!payload.basePrice) delete payload.basePrice;
    if (editingProduct) {
      await api.put(`/products/${editingProduct.id}`, payload);
    } else {
      await api.post('/products', payload);
    }
    setShowModal(false);
    setEditingProduct(null);
    setForm({ name: '', slug: '', description: '', icon: '', projectId: '', basePrice: '' });
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Produtos</h1>
          <p className="text-gray-500 text-sm mt-1">Produtos/Sistemas gerenciados pela plataforma</p>
        </div>
        <button onClick={openNew} className="px-4 py-2 bg-blue-900 text-white rounded-lg hover:bg-blue-800 text-sm font-medium">+ Novo Produto</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? <div className="col-span-full p-8 text-center text-gray-500">Carregando...</div>
        : products.length === 0 ? <div className="col-span-full p-8 text-center text-gray-500">Nenhum produto cadastrado</div>
        : products.map((p: any) => (
          <div key={p.id} onClick={() => navigate(`/products/${p.id}/plans`)} className={`bg-white rounded-xl shadow-sm border p-5 cursor-pointer hover:shadow-md transition-shadow ${!p.active ? 'opacity-60' : ''}`}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-bold text-gray-800">{p.icon || '📦'} {p.name}</h3>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full ${p.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{p.active ? 'Ativo' : 'Inativo'}</span>
            </div>
            {p.description && <p className="text-sm text-gray-600 mb-3">{p.description}</p>}
            <div className="flex items-center justify-between mt-3">
              <span className="text-xs text-blue-700 font-medium flex items-center gap-1">
                Ver planos →
              </span>
              <button
                onClick={(e) => openEdit(e, p)}
                className="text-xs text-gray-500 hover:text-blue-900 font-medium"
              >
                Editar
              </button>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSave} className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg space-y-4">
            <h3 className="text-lg font-bold text-gray-800">{editingProduct ? 'Editar Produto' : 'Novo Produto'}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value, slug: editingProduct ? form.slug : e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
                <input required value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Valor do Projeto (R$)</label>
                <input type="number" step="0.01" min="0" value={form.basePrice} onChange={(e) => setForm({ ...form, basePrice: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Projeto Railway</label>
                <select value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                  <option value="">Nenhum</option>
                  {projects.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => { setShowModal(false); setEditingProduct(null); }} className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50">Cancelar</button>
              <button type="submit" className="flex-1 py-2.5 bg-blue-900 text-white rounded-lg text-sm font-medium hover:bg-blue-800">{editingProduct ? 'Salvar' : 'Criar'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
