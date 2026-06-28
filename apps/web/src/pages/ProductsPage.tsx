import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';

export function ProductsPage() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [error, setError] = useState('');
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm] = useState({ name: '', slug: '', description: '', price: '', githubRepo: '', githubBranch: 'master', projectId: '' });

  const load = () => {
    setLoading(true);
    api.get('/products').then((res) => { setProducts(res.data); setLoading(false); });
  };

  useEffect(() => { load(); api.get('/deploy/railway/projects').then((res) => setProjects(res.data)).catch(() => {}); }, []);

  const openNew = () => {
    setEditingProduct(null);
    setForm({ name: '', slug: '', description: '', price: '', githubRepo: '', githubBranch: 'master', projectId: '' });
    setShowModal(true);
  };

  const openEdit = (e: React.MouseEvent, product: any) => {
    e.stopPropagation();
    setEditingProduct(product);
    setForm({
      name: product.name,
      slug: product.slug,
      description: product.description || '',
      price: (product.price / 100 || 0).toString(),
      githubRepo: product.githubRepo || '',
      githubBranch: product.githubBranch || 'master',
      projectId: product.projectId || '',
    });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError('');
      const slug = form.slug || form.name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
      const payload: any = {
        name: form.name,
        slug,
        description: form.description,
        price: Math.round((parseFloat(form.price) || 0) * 100),
        githubRepo: form.githubRepo,
        githubBranch: form.githubBranch || 'master',
      };
      if (form.projectId) payload.projectId = form.projectId;
      if (editingProduct) {
        await api.put(`/products/${editingProduct.id}`, payload);
      } else {
        await api.post('/products', payload);
      }
      setShowModal(false);
      setEditingProduct(null);
      setForm({ name: '', slug: '', description: '', price: '', githubRepo: '', githubBranch: 'master', projectId: '' });
      load();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Erro ao salvar produto');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setError('');
      await api.delete(`/products/${deleteTarget.id}`);
      setDeleteTarget(null);
      load();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Erro ao excluir produto');
    }
  };

  const toggleActive = async (e: React.MouseEvent, product: any) => {
    e.stopPropagation();
    try {
      await api.put(`/products/${product.id}`, { active: !product.active });
      load();
    } catch {}
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

      {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {loading ? <div className="col-span-full p-12 text-center text-gray-500">Carregando...</div>
        : products.length === 0 ? <div className="col-span-full p-12 text-center text-gray-500">Nenhum produto cadastrado</div>
        : products.map((p: any) => (
          <div
            key={p.id}
            onClick={() => navigate(`/products/${p.id}/plans`)}
            className={`group relative bg-white rounded-2xl border shadow-sm hover:shadow-lg transition-all duration-200 cursor-pointer ${
              !p.active ? 'opacity-50 border-gray-300' : 'border-black hover:border-gray-600'
            }`}
          >
            <div className="p-6">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-blue-900 flex items-center justify-center text-white text-lg font-bold shrink-0">
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-gray-900 truncate">{p.name}</h3>
                    {p.slug && <p className="text-xs text-gray-400 truncate">{p.slug}</p>}
                  </div>
                </div>
                <button
                  onClick={(e) => toggleActive(e, p)}
                  className={`shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full transition-colors ${
                    p.active
                      ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                  }`}
                >
                  {p.active ? 'Ativo' : 'Inativo'}
                </button>
              </div>

              {p.description && (
                <p className="text-sm text-gray-500 mb-4 line-clamp-2 leading-relaxed">{p.description}</p>
              )}

              <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400 mb-4">
                {p.price > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <span>💰</span> R$ {(p.price / 100).toFixed(2)}
                  </span>
                )}
                {p.githubRepo && (
                  <span className="inline-flex items-center gap-1" title={p.githubRepo}>
                    <span>📦</span> {p.githubRepo}
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <span className="text-sm font-semibold text-blue-700 group-hover:text-blue-600 transition-colors flex items-center gap-1.5">
                  Ver planos
                  <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </span>
                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                  <button onClick={(e) => openEdit(e, p)} className="p-1.5 text-gray-300 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Editar">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg>
                  </button>
                  <button onClick={() => setDeleteTarget(p)} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Excluir">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSave} className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg space-y-4">
            <h3 className="text-lg font-bold text-gray-800">{editingProduct ? 'Editar Produto' : 'Novo Produto'}</h3>
            {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              {!editingProduct && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
                  <input required value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Valor (R$)</label>
                <input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" placeholder="0.00" />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">GitHub Repo</label>
                <input value={form.githubRepo} onChange={(e) => setForm({ ...form, githubRepo: e.target.value })} placeholder="usuario/repo" className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
                <input value={form.githubBranch} onChange={(e) => setForm({ ...form, githubBranch: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Projeto Railway</label>
                <select value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                  <option value="">Nenhum</option>
                  {projects.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Descricao</label>
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

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold text-gray-800 mb-2">Excluir Produto</h3>
            <p className="text-sm text-gray-600 mb-4">Tem certeza que deseja excluir o produto <strong>{deleteTarget.name}</strong>? Todos os planos associados tambem serao removidos. Esta acao nao pode ser desfeita.</p>
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
