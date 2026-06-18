import { useEffect, useState } from 'react';
import api from '../lib/api';

interface RailwayProject {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Environment {
  id: string;
  name: string;
}

interface Variable {
  name: string;
  value: string;
}

export function RailwayPage() {
  const [projects, setProjects] = useState<RailwayProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [loadingEnvs, setLoadingEnvs] = useState(false);
  const [selectedEnv, setSelectedEnv] = useState<string>('');
  const [variables, setVariables] = useState<Variable[]>([]);
  const [loadingVars, setLoadingVars] = useState(false);
  const [showValues, setShowValues] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get('/deploy/railway/projects')
      .then((res) => setProjects(res.data))
      .catch((err) => setError(err.response?.data?.message || 'Erro ao carregar projetos'))
      .finally(() => setLoading(false));
  }, []);

  async function handleSelectProject(projectId: string) {
    if (expandedProject === projectId) {
      setExpandedProject(null);
      setEnvironments([]);
      setSelectedEnv('');
      setVariables([]);
      return;
    }
    setExpandedProject(projectId);
    setSelectedEnv('');
    setVariables([]);
    setLoadingEnvs(true);
    try {
      const res = await api.get(`/deploy/railway/projects/${projectId}/environments`);
      setEnvironments(res.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao carregar ambientes');
    } finally {
      setLoadingEnvs(false);
    }
  }

  async function handleSelectEnvironment(envId: string) {
    if (!expandedProject) return;
    setSelectedEnv(envId);
    setLoadingVars(true);
    try {
      const res = await api.get(`/deploy/railway/projects/${expandedProject}/variables`, {
        params: { environmentId: envId },
      });
      setVariables(res.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao carregar variáveis');
    } finally {
      setLoadingVars(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Railway</h1>
        <p className="text-gray-500 text-sm mt-1">
          Projetos e variáveis compartilhadas
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border p-8 text-center text-gray-500">
          Carregando...
        </div>
      ) : projects.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border p-8 text-center text-gray-500">
          {error ? 'Erro ao carregar' : 'Nenhum projeto encontrado'}
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map((project) => (
            <div key={project.id} className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <button
                onClick={() => handleSelectProject(project.id)}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 text-left"
              >
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-800">{project.name}</h3>
                  {project.description && (
                    <p className="text-sm text-gray-500 mt-0.5 truncate">{project.description}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    Criado em {new Date(project.createdAt).toLocaleString('pt-BR')}
                  </p>
                </div>
                <span className="text-gray-400 text-xl ml-4">
                  {expandedProject === project.id ? '▲' : '▼'}
                </span>
              </button>

              {expandedProject === project.id && (
                <div className="border-t bg-gray-50 p-4 space-y-4">
                  {loadingEnvs ? (
                    <div className="text-center text-gray-500 text-sm">Carregando ambientes...</div>
                  ) : environments.length === 0 ? (
                    <div className="text-center text-gray-500 text-sm">Nenhum ambiente encontrado</div>
                  ) : (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Selecione o ambiente
                        </label>
                        <select
                          value={selectedEnv}
                          onChange={(e) => handleSelectEnvironment(e.target.value)}
                          className="w-full max-w-xs px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                        >
                          <option value="">-- Selecione --</option>
                          {environments.map((env) => (
                            <option key={env.id} value={env.id}>
                              {env.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {selectedEnv && (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-semibold text-gray-700">
                              Variáveis Compartilhadas
                            </h4>
                            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={showValues}
                                onChange={() => setShowValues(!showValues)}
                                className="rounded border-gray-300"
                              />
                              Mostrar valores
                            </label>
                          </div>

                          {loadingVars ? (
                            <div className="text-center text-gray-500 text-sm py-4">
                              Carregando variáveis...
                            </div>
                          ) : variables.length === 0 ? (
                            <div className="text-center text-gray-500 text-sm py-4">
                              Nenhuma variável compartilhada
                            </div>
                          ) : (
                            <div className="bg-white rounded-lg border overflow-hidden">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="bg-gray-100 border-b">
                                    <th className="text-left px-4 py-2 font-medium text-gray-600">
                                      Nome
                                    </th>
                                    <th className="text-left px-4 py-2 font-medium text-gray-600">
                                      Valor
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y">
                                  {variables.map((v) => (
                                    <tr key={v.name} className="hover:bg-gray-50">
                                      <td className="px-4 py-2 font-mono text-blue-700">
                                        {v.name}
                                      </td>
                                      <td className="px-4 py-2 font-mono text-gray-700">
                                        {showValues ? v.value : '••••••••'}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
