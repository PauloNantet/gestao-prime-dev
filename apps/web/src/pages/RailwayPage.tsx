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

interface ProjectDatabase {
  projectId: string;
  environmentId: string;
  projectName: string;
  environmentName: string;
  databaseUrl: string;
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
  const [dbUrlInput, setDbUrlInput] = useState('');
  const [savingDb, setSavingDb] = useState(false);
  const [savedDbs, setSavedDbs] = useState<Record<string, ProjectDatabase>>({});
  const [queryResult, setQueryResult] = useState<{ tables: string[]; data: Record<string, any>[]; tableName: string | null } | null>(null);
  const [querying, setQuerying] = useState(false);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [columns, setColumns] = useState<{ name: string; type: string; nullable: boolean; default: string | null }[]>([]);
  const [primaryKey, setPrimaryKey] = useState<string | null>(null);
  const [showInsertForm, setShowInsertForm] = useState(false);
  const [insertData, setInsertData] = useState<Record<string, string>>({});
  const [inserting, setInserting] = useState(false);
  const [editingRow, setEditingRow] = useState<any | null>(null);

  useEffect(() => {
    Promise.all([
      api.get('/deploy/railway/projects'),
      api.get('/deploy/project-databases'),
    ])
      .then(([projRes, dbRes]) => {
        setProjects(projRes.data);
        const map: Record<string, ProjectDatabase> = {};
        for (const db of dbRes.data) map[`${db.projectId}:${db.environmentId}`] = db;
        setSavedDbs(map);
      })
      .catch((err) => setError(err.response?.data?.message || 'Erro ao carregar dados'))
      .finally(() => setLoading(false));
  }, []);

  function envKey(projectId: string, envId: string) {
    return `${projectId}:${envId}`;
  }

  function getSavedDb(projectId: string, envId: string) {
    return savedDbs[envKey(projectId, envId)] || null;
  }

  async function handleSelectProject(projectId: string) {
    if (expandedProject === projectId) {
      setExpandedProject(null);
      setEnvironments([]);
      setSelectedEnv('');
      setVariables([]);
      setQueryResult(null);
      return;
    }
    setExpandedProject(projectId);
    setSelectedEnv('');
    setVariables([]);
    setDbUrlInput('');
    setQueryResult(null);
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
    if (envId === selectedEnv) {
      setSelectedEnv('');
      setDbUrlInput('');
      setVariables([]);
      setQueryResult(null);
      return;
    }
    setSelectedEnv(envId);
    setQueryResult(null);
    const saved = getSavedDb(expandedProject, envId);
    setDbUrlInput(saved?.databaseUrl || '');
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

  async function handleSaveDbUrl() {
    if (!expandedProject || !selectedEnv || !dbUrlInput.trim()) return;
    setSavingDb(true);
    const env = environments.find(e => e.id === selectedEnv);
    const project = projects.find(p => p.id === expandedProject);
    try {
      const res = await api.post('/deploy/project-databases', {
        projectId: expandedProject,
        environmentId: selectedEnv,
        projectName: project?.name || '',
        environmentName: env?.name || '',
        databaseUrl: dbUrlInput.trim(),
      });
      setSavedDbs((prev) => ({ ...prev, [envKey(expandedProject, selectedEnv)]: res.data }));
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao salvar');
    } finally {
      setSavingDb(false);
    }
  }

  async function handleQueryTables() {
    if (!expandedProject || !selectedEnv) return;
    setQueryResult(null);
    setSelectedTable(null);
    setQuerying(true);
    try {
      const res = await api.get(`/deploy/project-databases/${expandedProject}/${selectedEnv}/query`);
      setQueryResult(res.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao consultar');
    } finally {
      setQuerying(false);
    }
  }

  async function handleSelectTable(tableName: string) {
    if (!expandedProject || !selectedEnv) return;
    setSelectedTable(tableName);
    setShowInsertForm(false);
    setEditingRow(null);
    setQuerying(true);
    try {
      const [queryRes, colsRes] = await Promise.all([
        api.get(`/deploy/project-databases/${expandedProject}/${selectedEnv}/query`, {
          params: { table: tableName },
        }),
        api.get(`/deploy/project-databases/${expandedProject}/${selectedEnv}/columns`, {
          params: { table: tableName },
        }),
      ]);
      setQueryResult(queryRes.data);
      setColumns(colsRes.data.columns);
      setPrimaryKey(colsRes.data.primaryKey);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao consultar tabela');
    } finally {
      setQuerying(false);
    }
  }

  function handleOpenInsertForm() {
    setEditingRow(null);
    const empty: Record<string, string> = {};
    for (const col of columns) {
      empty[col.name] = '';
    }
    setInsertData(empty);
    setShowInsertForm(true);
  }

  function handleEditRow(row: any) {
    setShowInsertForm(false);
    setEditingRow(row);
    const data: Record<string, string> = {};
    for (const col of columns) {
      data[col.name] = row[col.name] === null ? '' : String(row[col.name]);
    }
    setInsertData(data);
    setShowInsertForm(true);
  }

  function parseValue(val: string, col: { name: string; type: string; nullable: boolean; default: string | null }) {
    if (col.type === 'integer' || col.type === 'bigint' || col.type === 'smallint') {
      return parseInt(val, 10);
    } else if (col.type === 'numeric' || col.type === 'real' || col.type === 'double precision') {
      return parseFloat(val);
    } else if (col.type === 'boolean') {
      return val === 'true' || val === '1';
    }
    return val;
  }

  async function handleSave() {
    if (!expandedProject || !selectedEnv || !selectedTable) return;
    setInserting(true);
    try {
      const payload: Record<string, any> = {};
      for (const col of columns) {
        const val = insertData[col.name];
        if (val === '') {
          if (!col.nullable && col.default === null) {
            if (!editingRow) {
              setError(`Campo "${col.name}" é obrigatório`);
              setInserting(false);
              return;
            }
            continue;
          }
          continue;
        }
        payload[col.name] = parseValue(val, col);
      }

      if (editingRow && primaryKey) {
        await api.put(`/deploy/project-databases/${expandedProject}/${selectedEnv}/update`, {
          table: selectedTable,
          idColumn: primaryKey,
          idValue: parseValue(String(editingRow[primaryKey]), columns.find(c => c.name === primaryKey)!),
          data: payload,
        });
      } else {
        await api.post(`/deploy/project-databases/${expandedProject}/${selectedEnv}/insert`, {
          table: selectedTable,
          data: payload,
        });
      }
      setShowInsertForm(false);
      setEditingRow(null);
      await handleSelectTable(selectedTable);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao salvar');
    } finally {
      setInserting(false);
    }
  }

  const savedDb = selectedEnv && expandedProject ? getSavedDb(expandedProject, selectedEnv) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Railway</h1>
        <p className="text-gray-500 text-sm mt-1">
          Projetos, variáveis e conexão com banco de dados
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
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">Ambientes</h4>
                        <div className="flex flex-wrap gap-1.5">
                          {environments.map((env) => (
                            <button
                              key={env.id}
                              onClick={() => handleSelectEnvironment(env.id)}
                              className={`text-xs px-2.5 py-1.5 rounded font-medium transition-colors ${
                                selectedEnv === env.id
                                  ? 'bg-blue-900 text-white'
                                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                              }`}
                            >
                              {env.name}
                            </button>
                          ))}
                        </div>
                      </div>

                      {selectedEnv && (
                        <>
                          {/* Database URL - por ambiente */}
                          <div className="border-t pt-4">
                            <h4 className="text-sm font-semibold text-gray-700 mb-2">
                              Conexão com o Banco de Dados
                            </h4>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={dbUrlInput}
                                onChange={(e) => setDbUrlInput(e.target.value)}
                                placeholder="postgresql://user:pass@host:5432/dbname"
                                className="flex-1 px-3 py-2 border rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                              />
                              <button
                                onClick={handleSaveDbUrl}
                                disabled={savingDb || !dbUrlInput.trim()}
                                className="px-4 py-2 bg-blue-900 text-white rounded-lg text-sm hover:bg-blue-800 disabled:opacity-50"
                              >
                                {savingDb ? 'Salvando...' : 'Salvar'}
                              </button>
                            </div>
                            {savedDb && (
                              <div className="mt-2 text-xs text-green-700">
                                URL salva para este ambiente
                              </div>
                            )}
                          </div>

                          {/* Query tables */}
                          {savedDb && (
                            <div>
                              <button
                                onClick={handleQueryTables}
                                disabled={querying}
                                className="px-4 py-2 bg-emerald-700 text-white rounded-lg text-sm hover:bg-emerald-600 disabled:opacity-50"
                              >
                                {querying ? 'Consultando...' : 'Puxar informações do banco'}
                              </button>
                            </div>
                          )}

                          {queryResult && (
                            <div className="space-y-3">
                              <div>
                                <h4 className="text-sm font-semibold text-gray-700 mb-2">Tabelas encontradas</h4>
                                <div className="flex flex-wrap gap-1.5">
                                  {queryResult.tables.map((t) => (
                                    <button
                                      key={t}
                                      onClick={() => handleSelectTable(t)}
                                      className={`text-xs px-2.5 py-1.5 rounded font-medium transition-colors ${
                                        selectedTable === t
                                          ? 'bg-blue-900 text-white'
                                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                      }`}
                                    >
                                      {t}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              {queryResult.data.length > 0 && queryResult.tableName && (
                                <div>
                                  <div className="flex items-center justify-between mb-2">
                                    <h4 className="text-sm font-semibold text-gray-700">
                                      Dados de: {queryResult.tableName}
                                    </h4>
                                    {selectedTable && columns.length > 0 && (
                                      <button
                                        onClick={handleOpenInsertForm}
                                        className="px-3 py-1.5 bg-blue-900 text-white rounded-lg text-xs hover:bg-blue-800"
                                      >
                                        + Inserir
                                      </button>
                                    )}
                                  </div>
                                  <div className="bg-white rounded-lg border overflow-x-auto">
                                    <table className="w-full text-sm">
                                      <thead>
                                        <tr className="bg-gray-100 border-b">
                                          {Object.keys(queryResult.data[0]).map((col) => (
                                            <th key={col} className="text-left px-3 py-2 font-medium text-gray-600 whitespace-nowrap">
                                              {col}
                                            </th>
                                          ))}
                                          <th className="px-3 py-2 font-medium text-gray-600 whitespace-nowrap w-20">Ações</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y">
                                        {queryResult.data.map((row: any, i: number) => (
                                          <tr key={i} className="hover:bg-gray-50">
                                            {Object.keys(queryResult.data[0]).map((col, j) => (
                                              <td key={j} className="px-3 py-2 text-gray-700 whitespace-nowrap max-w-xs truncate">
                                                {row[col] === null ? <span className="text-gray-400">NULL</span> : String(row[col])}
                                              </td>
                                            ))}
                                            <td className="px-3 py-2">
                                              <button
                                                onClick={() => handleEditRow(row)}
                                                className="text-xs text-blue-700 hover:text-blue-900 font-medium"
                                              >
                                                Editar
                                              </button>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>

                                  {showInsertForm && (
                                    <div className="bg-white rounded-lg border p-4 space-y-3 mt-3">
                                      <h5 className="text-sm font-semibold text-gray-700">
                                        {editingRow ? 'Editar registro' : 'Inserir novo registro'}
                                      </h5>
                                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {columns.map((col) => {
                                          const isPk = col.name === primaryKey;
                                          return (
                                            <div key={col.name}>
                                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                                {col.name}
                                                <span className="text-gray-400 ml-1">({col.type})</span>
                                                {!col.nullable && <span className="text-red-500 ml-1">*</span>}
                                                {isPk && <span className="text-blue-500 ml-1">PK</span>}
                                              </label>
                                              <input
                                                type="text"
                                                value={insertData[col.name] || ''}
                                                onChange={(e) => setInsertData(prev => ({ ...prev, [col.name]: e.target.value }))}
                                                placeholder={col.nullable ? 'NULL' : 'obrigatório'}
                                                disabled={isPk && !!editingRow}
                                                className="w-full px-2.5 py-1.5 border rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100 disabled:text-gray-400"
                                              />
                                            </div>
                                          );
                                        })}
                                      </div>
                                      <div className="flex gap-2 pt-2">
                                        <button
                                          onClick={handleSave}
                                          disabled={inserting}
                                          className="px-4 py-2 bg-blue-900 text-white rounded-lg text-sm hover:bg-blue-800 disabled:opacity-50"
                                        >
                                          {inserting ? 'Salvando...' : 'Salvar'}
                                        </button>
                                        <button
                                          onClick={() => { setShowInsertForm(false); setEditingRow(null); }}
                                          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-300"
                                        >
                                          Cancelar
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}

                              {!queryResult.tableName && (
                                <div className="text-sm text-gray-500">
                                  Clique em uma tabela acima para visualizar seus dados.
                                </div>
                              )}
                            </div>
                          )}

                          {/* Variáveis */}
                          <div className="border-t pt-4">
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
                                      <th className="text-left px-4 py-2 font-medium text-gray-600">Nome</th>
                                      <th className="text-left px-4 py-2 font-medium text-gray-600">Valor</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y">
                                    {variables.map((v) => (
                                      <tr key={v.name} className="hover:bg-gray-50">
                                        <td className="px-4 py-2 font-mono text-blue-700">{v.name}</td>
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
                        </>
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
