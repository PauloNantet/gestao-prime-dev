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
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [loadingEnvs, setLoadingEnvs] = useState(false);
  const [savedDbs, setSavedDbs] = useState<Record<string, ProjectDatabase>>({});
  const [envDbUrls, setEnvDbUrls] = useState<Record<string, string>>({});
  const [editingDbEnv, setEditingDbEnv] = useState<string | null>(null);
  const [dbUrlInput, setDbUrlInput] = useState('');
  const [savingDb, setSavingDb] = useState(false);

  const [dbBrowserEnv, setDbBrowserEnv] = useState<{ envName: string; dbUrl: string } | null>(null);
  const [dbTables, setDbTables] = useState<string[]>([]);
  const [dbSelectedTable, setDbSelectedTable] = useState<string | null>(null);
  const [dbData, setDbData] = useState<any[]>([]);
  const [dbColumns, setDbColumns] = useState<{ name: string; type: string; nullable: boolean; default: string | null }[]>([]);
  const [dbPrimaryKey, setDbPrimaryKey] = useState<string | null>(null);
  const [dbLoading, setDbLoading] = useState(false);
  const [dbShowForm, setDbShowForm] = useState(false);
  const [dbEditingRow, setDbEditingRow] = useState<any | null>(null);
  const [dbFormData, setDbFormData] = useState<Record<string, string>>({});
  const [dbSaving, setDbSaving] = useState(false);

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

  async function handleSelectProject(projectId: string) {
    setSelectedProject(projectId);
    setEnvironments([]);
    setEnvDbUrls({});
    setEditingDbEnv(null);
    setLoadingEnvs(true);
    try {
      const res = await api.get(`/deploy/railway/projects/${projectId}/environments`);
      const envs: Environment[] = res.data;
      setEnvironments(envs);

      const urls: Record<string, string> = {};
      for (const env of envs) {
        const saved = savedDbs[envKey(projectId, env.id)];
        if (saved?.databaseUrl) {
          urls[env.id] = saved.databaseUrl;
        }
      }
      setEnvDbUrls(urls);

      const missing = envs.filter(e => !urls[e.id]);
      if (missing.length > 0) {
        try {
          const servicesRes = await api.get(`/deploy/railway/projects/${projectId}/services`);
          const services: { id: string; name: string }[] = servicesRes.data;

          const dbPatterns = [
            /^DATABASE_PUBLIC_URL$/i,
            /^DATABASE_URL$/i,
            /^POSTGRES_URL$/i,
            /^POSTGRESQL_URL$/i,
            /^DB_URL$/i,
          ];

          for (const env of missing) {
            let foundUrl = '';
            for (const service of services) {
              try {
                const varsRes = await api.get(`/deploy/railway/projects/${projectId}/services/${service.id}/variables`, {
                  params: { environmentId: env.id },
                });
                const vars: Variable[] = varsRes.data;

                for (const pattern of dbPatterns) {
                  const match = vars.find(v => pattern.test(v.name) && v.value?.startsWith('postgresql'));
                  if (match) { foundUrl = match.value; break; }
                }
                if (foundUrl) break;
              } catch {}
            }

            if (foundUrl) {
              setEnvDbUrls(prev => ({ ...prev, [env.id]: foundUrl }));
              const project = projects.find(p => p.id === projectId);
              api.post('/deploy/project-databases', {
                projectId,
                environmentId: env.id,
                projectName: project?.name || '',
                environmentName: env.name,
                databaseUrl: foundUrl,
              }).then(res => {
                setSavedDbs(prev => ({ ...prev, [envKey(projectId, env.id)]: res.data }));
              }).catch(() => {});
            }
          }
        } catch {}
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao carregar ambientes');
    } finally {
      setLoadingEnvs(false);
    }
  }

  async function handleSaveDbUrl(envId: string) {
    if (!selectedProject || !dbUrlInput.trim()) return;
    setSavingDb(true);
    const env = environments.find(e => e.id === envId);
    const project = projects.find(p => p.id === selectedProject);
    try {
      const res = await api.post('/deploy/project-databases', {
        projectId: selectedProject,
        environmentId: envId,
        projectName: project?.name || '',
        environmentName: env?.name || '',
        databaseUrl: dbUrlInput.trim(),
      });
      setSavedDbs(prev => ({ ...prev, [envKey(selectedProject, envId)]: res.data }));
      setEnvDbUrls(prev => ({ ...prev, [envId]: dbUrlInput.trim() }));
      setEditingDbEnv(null);
      setDbUrlInput('');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao salvar');
    } finally {
      setSavingDb(false);
    }
  }

  async function openDbBrowser(envName: string, dbUrl: string) {
    setDbBrowserEnv({ envName, dbUrl });
    setDbTables([]);
    setDbSelectedTable(null);
    setDbData([]);
    setDbColumns([]);
    setDbShowForm(false);
    setDbLoading(true);
    try {
      const res = await api.post('/deploy/direct-query', { databaseUrl: dbUrl });
      setDbTables(res.data.tables);
    } catch { }
    setDbLoading(false);
  }

  async function handleDbSelectTable(tableName: string) {
    if (!dbBrowserEnv) return;
    setDbSelectedTable(tableName);
    setDbShowForm(false);
    setDbEditingRow(null);
    setDbLoading(true);
    try {
      const [queryRes, colsRes] = await Promise.all([
        api.post('/deploy/direct-query', { databaseUrl: dbBrowserEnv.dbUrl, table: tableName }),
        api.post('/deploy/direct-columns', { databaseUrl: dbBrowserEnv.dbUrl, table: tableName }),
      ]);
      setDbData(queryRes.data.data);
      setDbColumns(colsRes.data.columns);
      setDbPrimaryKey(colsRes.data.primaryKey);
    } catch { }
    setDbLoading(false);
  }

  function openDbInsert() {
    setDbEditingRow(null);
    const empty: Record<string, string> = {};
    for (const col of dbColumns) empty[col.name] = '';
    setDbFormData(empty);
    setDbShowForm(true);
  }

  function openDbEdit(row: any) {
    setDbEditingRow(row);
    const data: Record<string, string> = {};
    for (const col of dbColumns) data[col.name] = row[col.name] === null ? '' : String(row[col.name]);
    setDbFormData(data);
    setDbShowForm(true);
  }

  async function handleDbSave() {
    if (!dbBrowserEnv || !dbSelectedTable) return;
    setDbSaving(true);
    try {
      const payload: Record<string, any> = {};
      for (const col of dbColumns) {
        const val = dbFormData[col.name];
        if (val === '') continue;
        if (col.type === 'integer' || col.type === 'bigint') payload[col.name] = parseInt(val, 10);
        else if (col.type === 'numeric' || col.type === 'real') payload[col.name] = parseFloat(val);
        else if (col.type === 'boolean') payload[col.name] = val === 'true' || val === '1';
        else payload[col.name] = val;
      }

      if (dbEditingRow && dbPrimaryKey) {
        await api.put('/deploy/direct-update', {
          databaseUrl: dbBrowserEnv.dbUrl, table: dbSelectedTable,
          idColumn: dbPrimaryKey, idValue: dbEditingRow[dbPrimaryKey],
          data: payload,
        });
      } else {
        await api.post('/deploy/direct-insert', {
          databaseUrl: dbBrowserEnv.dbUrl, table: dbSelectedTable, data: payload,
        });
      }
      setDbShowForm(false);
      setDbEditingRow(null);
      await handleDbSelectTable(dbSelectedTable);
    } catch { }
    setDbSaving(false);
  }

  const sortedEnvironments = [...environments].sort((a, b) => a.name.localeCompare(b.name));
  const currentProject = projects.find(p => p.id === selectedProject);

  const envDbDisplay = sortedEnvironments.reduce<Record<string, string>>((acc, env) => {
    if (envDbUrls[env.id]) acc[env.id] = envDbUrls[env.id];
    else if (selectedProject) {
      const saved = savedDbs[envKey(selectedProject, env.id)];
      if (saved?.databaseUrl) acc[env.id] = saved.databaseUrl;
    }
    return acc;
  }, {});

  if (selectedProject) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setSelectedProject(null); setEnvironments([]); setEnvDbUrls({}); }}
            className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">{currentProject?.name || 'Projeto'}</h1>
            {currentProject?.description && <p className="text-gray-500 text-sm mt-0.5">{currentProject.description}</p>}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
            {error}
            <button onClick={() => setError('')} className="ml-2 underline">limpar</button>
          </div>
        )}

        {loadingEnvs ? (
          <div className="bg-white rounded-xl shadow-sm border p-8 text-center text-gray-500">
            Carregando ambientes...
          </div>
        ) : sortedEnvironments.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border p-8 text-center text-gray-500">
            Nenhum ambiente encontrado
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left p-4 font-medium text-gray-600">Ambiente</th>
                  <th className="text-left p-4 font-medium text-gray-600">URL do Banco</th>
                  <th className="text-right p-4 font-medium text-gray-600 w-40">Acoes</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sortedEnvironments.map((env) => {
                  const dbUrl = envDbDisplay[env.id] || '';
                  const isEditing = editingDbEnv === env.id;
                  const hasDb = !!dbUrl;

                  return (
                    <tr key={env.id} className="hover:bg-gray-50">
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                          <span className="font-medium text-gray-800">{env.name}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        {isEditing ? (
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={dbUrlInput}
                              onChange={(e) => setDbUrlInput(e.target.value)}
                              placeholder="postgresql://user:pass@host:5432/dbname"
                              autoFocus
                              className="flex-1 px-3 py-1.5 border rounded-lg text-xs font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                            <button
                              onClick={() => handleSaveDbUrl(env.id)}
                              disabled={savingDb || !dbUrlInput.trim()}
                              className="px-3 py-1.5 bg-blue-900 text-white rounded-lg text-xs hover:bg-blue-800 disabled:opacity-50"
                            >
                              {savingDb ? '...' : 'Salvar'}
                            </button>
                            <button
                              onClick={() => { setEditingDbEnv(null); setDbUrlInput(''); }}
                              className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg text-xs hover:bg-gray-300"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : hasDb ? (
                          <span className="font-mono text-xs text-gray-600 truncate max-w-md block" title={dbUrl}>
                            {dbUrl}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">Nao configurado</span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        {!isEditing && (
                          <div className="flex items-center justify-end gap-1.5">
                            {hasDb && (
                              <button
                                onClick={() => openDbBrowser(env.name, dbUrl)}
                                className="px-3 py-1.5 text-xs bg-emerald-700 text-white rounded-lg hover:bg-emerald-600 transition-colors"
                              >
                                Banco
                              </button>
                            )}
                            <button
                              onClick={() => { setEditingDbEnv(env.id); setDbUrlInput(dbUrl); }}
                              className="px-3 py-1.5 text-xs bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                            >
                              {hasDb ? 'Editar' : 'Configurar'}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {dbBrowserEnv && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col">
              <div className="flex items-center justify-between p-4 border-b">
                <h3 className="text-lg font-bold text-gray-800">Banco — {dbBrowserEnv.envName}</h3>
                <button onClick={() => { setDbBrowserEnv(null); setDbTables([]); setDbSelectedTable(null); setDbData([]); }}
                  className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/></svg>
                </button>
              </div>
              <div className="p-4 overflow-y-auto flex-1 space-y-4">
                {dbLoading ? (
                  <div className="text-center text-gray-500 py-8">Carregando...</div>
                ) : (
                  <>
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-2">Tabelas</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {dbTables.map((t) => (
                          <button key={t} onClick={() => handleDbSelectTable(t)}
                            className={`text-xs px-2.5 py-1.5 rounded font-medium transition-colors ${
                              dbSelectedTable === t ? 'bg-blue-900 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}>{t}</button>
                        ))}
                      </div>
                    </div>
                    {dbData.length > 0 && dbSelectedTable && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-semibold text-gray-700">Dados de: {dbSelectedTable}</h4>
                          <button onClick={openDbInsert} className="px-3 py-1.5 bg-blue-900 text-white rounded-lg text-xs hover:bg-blue-800">+ Inserir</button>
                        </div>
                        <div className="bg-white rounded-lg border overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-gray-100 border-b">
                                {Object.keys(dbData[0]).map((col) => (
                                  <th key={col} className="text-left px-3 py-2 font-medium text-gray-600 whitespace-nowrap">{col}</th>
                                ))}
                                <th className="px-3 py-2 font-medium text-gray-600 w-16">Acoes</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {dbData.map((row: any, i: number) => (
                                <tr key={i} className="hover:bg-gray-50">
                                  {Object.keys(dbData[0]).map((col) => (
                                    <td key={col} className="px-3 py-2 text-gray-700 whitespace-nowrap max-w-xs truncate">
                                      {row[col] === null ? <span className="text-gray-400">NULL</span> : String(row[col])}
                                    </td>
                                  ))}
                                  <td className="px-3 py-2">
                                    <button onClick={() => openDbEdit(row)} className="text-xs text-blue-700 hover:text-blue-900 font-medium">Editar</button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                    {dbShowForm && (
                      <div className="bg-white rounded-lg border p-4 space-y-3">
                        <h5 className="text-sm font-semibold text-gray-700">{dbEditingRow ? 'Editar registro' : 'Inserir novo registro'}</h5>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {dbColumns.map((col: any) => (
                            <div key={col.name}>
                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                {col.name} <span className="text-gray-400">({col.type})</span>
                                {!col.nullable && <span className="text-red-500 ml-1">*</span>}
                              </label>
                              <input type="text" value={dbFormData[col.name] || ''}
                                onChange={(e) => setDbFormData((p: any) => ({ ...p, [col.name]: e.target.value }))}
                                placeholder={col.nullable ? 'NULL' : 'obrigatorio'}
                                disabled={col.name === dbPrimaryKey && !!dbEditingRow}
                                className="w-full px-2.5 py-1.5 border rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100" />
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-2 pt-2">
                          <button onClick={handleDbSave} disabled={dbSaving}
                            className="px-4 py-2 bg-blue-900 text-white rounded-lg text-sm hover:bg-blue-800 disabled:opacity-50">
                            {dbSaving ? 'Salvando...' : 'Salvar'}
                          </button>
                          <button onClick={() => { setDbShowForm(false); setDbEditingRow(null); }}
                            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-300">Cancelar</button>
                        </div>
                      </div>
                    )}
                    {!dbSelectedTable && dbTables.length > 0 && (
                      <div className="text-sm text-gray-500 text-center py-4">
                        Selecione uma tabela para visualizar seus dados.
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Railway</h1>
        <p className="text-gray-500 text-sm mt-1">
          Projetos, ambientes e conexao com banco de dados
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
          {error}
          <button onClick={() => setError('')} className="ml-2 underline">limpar</button>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...projects].sort((a, b) => a.name.localeCompare(b.name)).map((project) => {
            const projectEnvCount = Object.keys(savedDbs).filter(k => k.startsWith(project.id + ':')).length;
            return (
              <button
                key={project.id}
                onClick={() => handleSelectProject(project.id)}
                className="text-left bg-white rounded-xl shadow-sm border p-5 hover:shadow-md hover:border-blue-200 transition-all cursor-pointer"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-800 truncate">{project.name}</h3>
                    {project.description && (
                      <p className="text-sm text-gray-500 mt-1 truncate">{project.description}</p>
                    )}
                  </div>
                  <svg className="h-5 w-5 text-gray-300 shrink-0 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </div>
                <div className="text-xs text-gray-400">
                  {projectEnvCount > 0 ? `${projectEnvCount} banco(s) configurado(s)` : 'Clique para configurar'}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
