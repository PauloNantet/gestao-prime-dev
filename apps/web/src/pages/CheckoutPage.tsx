import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../lib/api';

export function CheckoutPage() {
  const { tenantId } = useParams();
  const navigate = useNavigate();
  const [tenant, setTenant] = useState<any>(null);
  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    api.get(`/tenants/${tenantId}`).then((res) => {
      setTenant(res.data);
      setLoading(false);
    });
  }, [tenantId]);

  const handleCheckout = async () => {
    setPaying(true);
    try {
      const res = await api.post(`/billing/checkout/${tenantId}`);
      setInvoice(res.data);
    } catch (err) {
      alert('Erro ao gerar cobrança');
    } finally {
      setPaying(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Carregando...</div>;

  return (
    <div className="max-w-lg mx-auto py-12 px-4">
      <div className="bg-white rounded-2xl shadow-sm border p-8 text-center">
        <div className="text-4xl mb-4">🚀</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Quase lá!</h1>
        <p className="text-gray-500 mb-6">
          {tenant?.name} — Plano: {tenant?.subscription?.planName}
        </p>

        {tenant?.subscription && (
          <div className="bg-gray-50 rounded-xl p-4 mb-6">
            <p className="text-sm text-gray-500">Valor</p>
            <p className="text-3xl font-bold text-gray-800">
              R$ {(tenant.subscription.planPrice / 100).toFixed(2)}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {tenant.subscription.planValidityDays} dias de acesso
            </p>
          </div>
        )}

        {invoice ? (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <p className="text-green-700 font-medium mb-2">Fatura gerada!</p>
              {invoice.pixQrCode && (
                <img src={`data:image/png;base64,${invoice.pixQrCode}`} alt="PIX QR Code" className="mx-auto w-48 h-48 mb-3" />
              )}
              {invoice.pixCopiaCola && (
                <div className="bg-white rounded-lg p-3 border">
                  <p className="text-xs text-gray-500 mb-1">Pix Copia e Cola:</p>
                  <code className="text-xs break-all text-gray-700">{invoice.pixCopiaCola}</code>
                </div>
              )}
            </div>
            <button onClick={() => navigate('/')} className="w-full py-3 bg-blue-900 text-white rounded-lg text-sm font-medium hover:bg-blue-800">
              Ir para Dashboard
            </button>
          </div>
        ) : (
          <button
            onClick={handleCheckout}
            disabled={paying}
            className="w-full py-3 bg-blue-900 text-white rounded-lg text-sm font-medium hover:bg-blue-800 disabled:opacity-50"
          >
            {paying ? 'Gerando...' : 'Pagar com PIX'}
          </button>
        )}
      </div>
    </div>
  );
}
