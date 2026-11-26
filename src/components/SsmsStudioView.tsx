import React, { useState, useEffect } from 'react';
import {
  fetchSsmsSchema,
  runSsmsQuery,
  downloadSsmsSql,
} from '../services/api';
import {
  Database,
  Terminal,
  Play,
  Download,
  Copy,
  Check,
  Server,
  Folder,
  FolderOpen,
  Table as TableIcon,
  Eye,
  FileCode2,
  ShieldCheck,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  Info,
  AlertCircle,
  X,
} from 'lucide-react';

interface SsmsStudioViewProps {
  onBackToExplore?: () => void;
}

interface SsmsMetadata {
  databaseName: string;
  databaseClient: string;
  compatibility: string;
  collation: string;
  fileSizeKb: number;
  connectionStrings: {
    windowsAuth: string;
    localDb: string;
    sqlAuth: string;
    efCore: string;
  };
  tables: Array<{
    name: string;
    rowCount: number;
    description: string;
    columns: Array<{ name: string; type: string; isPk?: boolean; isFk?: boolean }>;
  }>;
  views: Array<{ name: string; description: string }>;
  storedProcedures: Array<{ name: string; params: string; description: string }>;
}

export const SsmsStudioView: React.FC<SsmsStudioViewProps> = ({ onBackToExplore }) => {
  const [metadata, setMetadata] = useState<SsmsMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [activePreset, setActivePreset] = useState<string>('places-top');
  const [queryText, setQueryText] = useState<string>(
    `-- Извличане на обекти от каталога, подредени по надморска височина\nSELECT TOP 15 PlaceId, Name, CategoryName, RegionName, ElevationMeters, Difficulty\nFROM dbo.Places\nORDER BY ElevationMeters DESC;`
  );
  const [isExecuting, setIsExecuting] = useState(false);
  const [queryResult, setQueryResult] = useState<{
    columns: string[];
    rows: any[];
    rowCount: number;
    executionTimeMs: number;
    messages: string;
  } | null>(null);
  const [activeResultTab, setActiveResultTab] = useState<'results' | 'messages' | 'guide'>('results');
  const [copiedConn, setCopiedConn] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [expandedNodes, setExpandedNodes] = useState<{ [key: string]: boolean }>({
    databases: true,
    bulgariaDb: true,
    tables: true,
    views: true,
    procs: false,
  });

  const toggleNode = (nodeKey: string) => {
    setExpandedNodes((prev) => ({ ...prev, [nodeKey]: !prev[nodeKey] }));
  };

  useEffect(() => {
    loadMetadata();
    executeQuery(queryText);
  }, []);

  const loadMetadata = async () => {
    try {
      setLoading(true);
      setActionError(null);
      const data = await fetchSsmsSchema();
      setMetadata(data);
    } catch (err: any) {
      setActionError(err.message || 'Неуспешно зареждане на SSMS схемата.');
    } finally {
      setLoading(false);
    }
  };

  const executeQuery = async (sqlToRun?: string) => {
    const q = sqlToRun || queryText;
    setIsExecuting(true);
    setActionError(null);
    try {
      const data = await runSsmsQuery(q);
      if (data.success) {
        setQueryResult(data);
      } else {
        setQueryResult({
          columns: ['Error'],
          rows: [{ Error: data.error || 'Грешка при изпълнение на T-SQL' }],
          rowCount: 0,
          executionTimeMs: 0,
          messages: data.messages || data.error,
        });
      }
    } catch (err: any) {
      setQueryResult({
        columns: ['Error'],
        rows: [{ Error: err.message || 'Сървърна грешка при заявката' }],
        rowCount: 0,
        executionTimeMs: 0,
        messages: `Msg 50000: ${err.message}`,
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const placesRowCount =
    metadata?.tables?.find((t) => t.name === 'dbo.Places')?.rowCount ?? 48;

  const handlePresetSelect = (presetKey: string) => {
    setActivePreset(presetKey);
    let sql = '';
    switch (presetKey) {
      case 'places-top':
        sql = `-- Извличане на топ 15 от общо ${placesRowCount} обекта по надморска височина\nSELECT TOP 15 PlaceId, Name, CategoryName, RegionName, ElevationMeters, Difficulty\nFROM dbo.Places\nORDER BY ElevationMeters DESC;`;
        break;
      case 'regional-stats':
        sql = `-- Аналитична статистика по географски региони (View)\nSELECT RegionId, RegionName, TotalPlaces, MinElevation, MaxElevation, AvgElevation, FeaturedPlacesCount\nFROM dbo.vw_RegionalStatistics\nORDER BY TotalPlaces DESC;`;
        break;
      case 'featured-gems':
        sql = `-- Кураторски селектирани съкровища на България (View)\nSELECT PlaceId, PlaceName, CategoryName, RegionName, ElevationMeters, Difficulty\nFROM dbo.vw_FeaturedDestinations;`;
        break;
      case 'rhodopes-sanctuaries':
        sql = `-- Тракийски светилища в Родопите\nSELECT PlaceId, Name, CategoryName, RegionName, Latitude, Longitude\nFROM dbo.Places\nWHERE RegionId = 'south_central' AND CategoryId = 'sanctuaries';`;
        break;
      case 'all-categories':
        sql = `-- Категории в релационната база данни\nSELECT CategoryId, Name, Slug, Description, Icon\nFROM dbo.Categories;`;
        break;
      case 'routes':
        sql = `-- Експедиционни маршрути през България\nSELECT RouteId, Title, RegionId, Difficulty, DurationHours, DistanceKm\nFROM dbo.Routes;`;
        break;
      default:
        sql = `SELECT * FROM dbo.Places;`;
    }
    setQueryText(sql);
    executeQuery(sql);
  };

  const handleDownloadSql = async () => {
    setActionError(null);
    try {
      await downloadSsmsSql();
    } catch (err: any) {
      setActionError(err.message || 'Грешка при изтегляне на .SQL скрипта.');
    }
  };

  const handleCopyConnectionString = () => {
    if (metadata?.connectionStrings?.windowsAuth) {
      navigator.clipboard.writeText(metadata.connectionStrings.windowsAuth);
      setCopiedConn(true);
      setTimeout(() => setCopiedConn(false), 2500);
    }
  };

  return (
    <div className="min-h-screen bg-[#1E1E1E] text-stone-200 flex flex-col font-sans">
      {/* Top Application Bar */}
      <div className="bg-[#2D2D30] border-b border-[#3E3E42] px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-[#0078D4] text-white flex items-center justify-center font-bold">
            <Database className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="font-semibold text-white flex flex-wrap items-center gap-2">
              <span>Microsoft SQL Server Management Studio (SSMS) — Администраторско Студио</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold uppercase">
                Admin Only
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#0078D4]/30 text-[#60A5FA] border border-[#0078D4]/50">
                T-SQL 2022
              </span>
            </div>
            <div className="text-[11px] text-stone-400 font-mono">
              Server: (localdb)\MSSQLLocalDB | DB: [BulgariaTravel] | Collation: Cyrillic_General_100_CI_AI_SC_UTF8
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => executeQuery()}
            disabled={isExecuting}
            className="px-3.5 py-1.5 bg-[#0078D4] hover:bg-[#106EBE] active:bg-[#005A9E] text-white rounded font-medium flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            title="Изпълни T-SQL заявката"
          >
            <Play className={`w-3.5 h-3.5 fill-current ${isExecuting ? 'animate-spin' : ''}`} />
            <span>{isExecuting ? 'Изпълнява се...' : 'Изпълни (Execute)'}</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadSql}
            className="px-3 py-1.5 bg-[#3E3E42] hover:bg-[#4E4E52] text-stone-100 rounded font-medium flex items-center gap-1.5 transition-colors border border-[#55555A] cursor-pointer"
            title="Свали пълния .sql файл за отваряне в SSMS на Windows"
          >
            <Download className="w-3.5 h-3.5 text-amber-400" />
            <span className="tabular-nums">
              Свали .SQL за SSMS ({metadata?.fileSizeKb || 78} KB)
            </span>
          </button>

          {onBackToExplore && (
            <button
              type="button"
              onClick={onBackToExplore}
              className="px-3 py-1.5 text-stone-300 hover:text-white hover:bg-[#3E3E42] rounded transition-colors cursor-pointer"
            >
              Към сайта
            </button>
          )}
        </div>
      </div>

      {actionError && (
        <div
          role="alert"
          className="bg-red-950/80 border-b border-red-800 text-red-200 px-4 py-2 text-xs flex items-center justify-between gap-2"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-red-300 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main SSMS Workspace */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* LEFT: Object Explorer Tree */}
        <div className="w-full md:w-80 bg-[#252526] border-r border-[#3E3E42] flex flex-col shrink-0 overflow-y-auto max-h-[40vh] md:max-h-[calc(100vh-120px)] text-xs">
          <div className="px-3 py-2 bg-[#2D2D30] font-semibold text-stone-300 flex items-center justify-between border-b border-[#3E3E42]">
            <span className="flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-blue-400" />
              <span>Object Explorer</span>
            </span>
            <button
              type="button"
              onClick={loadMetadata}
              className="text-stone-400 hover:text-white cursor-pointer"
              title="Презареди структурата"
              aria-label="Презареди структурата"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="p-2 space-y-1 font-mono text-[11px]">
            <div className="flex items-center gap-1 text-stone-300 py-1">
              <Server className="w-3.5 h-3.5 text-blue-400" />
              <span className="font-semibold text-white">localhost\SQL2022</span>
            </div>

            <div className="pl-3">
              <div
                onClick={() => toggleNode('databases')}
                className="flex items-center gap-1 text-stone-300 py-0.5 cursor-pointer hover:bg-[#2A2D2E] rounded px-1"
              >
                {expandedNodes.databases ? (
                  <ChevronDown className="w-3 h-3 text-stone-400" />
                ) : (
                  <ChevronRight className="w-3 h-3 text-stone-400" />
                )}
                {expandedNodes.databases ? (
                  <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
                ) : (
                  <Folder className="w-3.5 h-3.5 text-amber-400" />
                )}
                <span>Databases</span>
              </div>

              {expandedNodes.databases && (
                <div className="pl-3 space-y-1">
                  <div>
                    <div
                      onClick={() => toggleNode('bulgariaDb')}
                      className="flex items-center gap-1 text-stone-200 py-0.5 cursor-pointer hover:bg-[#2A2D2E] rounded px-1"
                    >
                      {expandedNodes.bulgariaDb ? (
                        <ChevronDown className="w-3 h-3 text-stone-400" />
                      ) : (
                        <ChevronRight className="w-3 h-3 text-stone-400" />
                      )}
                      <Database className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="font-bold text-white">BulgariaTravel</span>
                    </div>

                    {expandedNodes.bulgariaDb && (
                      <div className="pl-3 space-y-1 text-stone-400">
                        <div>
                          <div
                            onClick={() => toggleNode('tables')}
                            className="flex items-center gap-1 py-0.5 cursor-pointer hover:bg-[#2A2D2E] rounded px-1 text-stone-300"
                          >
                            {expandedNodes.tables ? (
                              <ChevronDown className="w-3 h-3 text-stone-400" />
                            ) : (
                              <ChevronRight className="w-3 h-3 text-stone-400" />
                            )}
                            <Folder className="w-3.5 h-3.5 text-amber-300" />
                            <span>Tables ({metadata?.tables?.length || 6})</span>
                          </div>

                          {expandedNodes.tables && (
                            <div className="pl-3 space-y-0.5">
                              {metadata?.tables?.map((tbl) => (
                                <div
                                  key={tbl.name}
                                  onClick={() => {
                                    const sql = `SELECT TOP 20 * FROM ${tbl.name};`;
                                    setQueryText(sql);
                                    executeQuery(sql);
                                  }}
                                  className="flex items-center justify-between py-0.5 px-1 hover:bg-[#094771] hover:text-white rounded cursor-pointer group"
                                  title={tbl.description}
                                >
                                  <span className="flex items-center gap-1 truncate text-stone-300 group-hover:text-white">
                                    <TableIcon className="w-3 h-3 text-blue-400 shrink-0" />
                                    <span>{tbl.name}</span>
                                  </span>
                                  <span className="text-[10px] text-stone-500 group-hover:text-stone-300 ml-1 tabular-nums">
                                    {tbl.rowCount}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div>
                          <div
                            onClick={() => toggleNode('views')}
                            className="flex items-center gap-1 py-0.5 cursor-pointer hover:bg-[#2A2D2E] rounded px-1 text-stone-300"
                          >
                            {expandedNodes.views ? (
                              <ChevronDown className="w-3 h-3 text-stone-400" />
                            ) : (
                              <ChevronRight className="w-3 h-3 text-stone-400" />
                            )}
                            <Folder className="w-3.5 h-3.5 text-amber-300" />
                            <span>Views ({metadata?.views?.length || 3})</span>
                          </div>

                          {expandedNodes.views && (
                            <div className="pl-3 space-y-0.5">
                              {metadata?.views?.map((vw) => (
                                <div
                                  key={vw.name}
                                  onClick={() => {
                                    const sql = `SELECT * FROM ${vw.name};`;
                                    setQueryText(sql);
                                    executeQuery(sql);
                                  }}
                                  className="flex items-center gap-1 py-0.5 px-1 hover:bg-[#094771] hover:text-white rounded cursor-pointer text-stone-300"
                                  title={vw.description}
                                >
                                  <Eye className="w-3 h-3 text-purple-400 shrink-0" />
                                  <span className="truncate">{vw.name}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div>
                          <div
                            onClick={() => toggleNode('procs')}
                            className="flex items-center gap-1 py-0.5 cursor-pointer hover:bg-[#2A2D2E] rounded px-1 text-stone-300"
                          >
                            {expandedNodes.procs ? (
                              <ChevronDown className="w-3 h-3 text-stone-400" />
                            ) : (
                              <ChevronRight className="w-3 h-3 text-stone-400" />
                            )}
                            <Folder className="w-3.5 h-3.5 text-amber-300" />
                            <span>Stored Procedures</span>
                          </div>

                          {expandedNodes.procs && (
                            <div className="pl-3 space-y-0.5">
                              {metadata?.storedProcedures?.map((sp) => (
                                <div
                                  key={sp.name}
                                  onClick={() => {
                                    const sql = `-- Изпълнение на съхранена процедура с пространствен GEOGRAPHY филтър\nEXEC ${sp.name} @Latitude = 41.8547, @Longitude = 24.9669, @RadiusKm = 40.0;`;
                                    setQueryText(sql);
                                    executeQuery(sql);
                                  }}
                                  className="flex items-center gap-1 py-0.5 px-1 hover:bg-[#094771] hover:text-white rounded cursor-pointer text-stone-300"
                                  title={sp.description}
                                >
                                  <FileCode2 className="w-3 h-3 text-emerald-400 shrink-0" />
                                  <span className="truncate">{sp.name}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-auto p-3 bg-[#1E1E1E] border-t border-[#3E3E42] space-y-2">
            <div className="text-[10px] uppercase font-bold text-stone-400 flex items-center justify-between">
              <span>Connection String</span>
              <button
                type="button"
                onClick={handleCopyConnectionString}
                className="text-blue-400 hover:text-blue-300 flex items-center gap-1 lowercase text-[10px] cursor-pointer"
              >
                {copiedConn ? (
                  <Check className="w-3 h-3 text-emerald-400" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
                <span>{copiedConn ? 'Копирано' : 'Копирай'}</span>
              </button>
            </div>
            <div className="p-2 bg-[#141414] rounded border border-[#333333] font-mono text-[10px] text-stone-300 break-all leading-tight select-all">
              {metadata?.connectionStrings?.windowsAuth ||
                'Server=localhost;Database=BulgariaTravel;Trusted_Connection=True;TrustServerCertificate=True;'}
            </div>
          </div>
        </div>

        {/* RIGHT: Query Editor & Live Results Pane */}
        <div className="flex-1 flex flex-col bg-[#1E1E1E] overflow-hidden">
          <div className="bg-[#252526] border-b border-[#3E3E42] px-3 py-1.5 flex items-center gap-2 overflow-x-auto text-xs">
            <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mr-1">
              Готови T-SQL заявки:
            </span>
            {[
              { id: 'places-top', label: `Всички ${placesRowCount} обекта (TOP 15)` },
              { id: 'regional-stats', label: 'vw_RegionalStatistics' },
              { id: 'featured-gems', label: 'vw_FeaturedDestinations' },
              { id: 'rhodopes-sanctuaries', label: 'Родопски светилища' },
              { id: 'all-categories', label: 'dbo.Categories' },
              { id: 'routes', label: 'dbo.Routes' },
            ].map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => handlePresetSelect(preset.id)}
                className={`px-2.5 py-1 rounded text-xs transition-colors whitespace-nowrap cursor-pointer ${
                  activePreset === preset.id
                    ? 'bg-[#0078D4] text-white font-medium'
                    : 'bg-[#2D2D30] hover:bg-[#3E3E42] text-stone-300'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="p-3 bg-[#1E1E1E] border-b border-[#3E3E42]">
            <div className="flex items-center justify-between text-xs text-stone-400 mb-1.5 font-mono">
              <span className="flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-blue-400" />
                <span>SQLQuery1.sql — [BulgariaTravel]</span>
              </span>
              <span className="text-[11px] text-stone-500">T-SQL Syntax</span>
            </div>
            <textarea
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              rows={5}
              className="w-full font-mono text-xs text-[#DCDCDC] bg-[#141414] border border-[#3E3E42] rounded p-2.5 focus:outline-none focus:border-[#0078D4] focus:ring-1 focus:ring-[#0078D4] leading-relaxed resize-y"
              placeholder="Въведете SELECT или EXEC заявка тук..."
            />
          </div>

          <div className="bg-[#252526] border-b border-[#3E3E42] px-3 flex items-center justify-between text-xs">
            <div className="flex items-center gap-1 overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveResultTab('results')}
                className={`px-4 py-2 font-medium border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  activeResultTab === 'results'
                    ? 'text-white border-[#0078D4] bg-[#1E1E1E]'
                    : 'text-stone-400 border-transparent hover:text-stone-200'
                }`}
              >
                <TableIcon className="w-3.5 h-3.5" />
                <span className="tabular-nums">Results ({queryResult?.rowCount || 0})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveResultTab('messages')}
                className={`px-4 py-2 font-medium border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  activeResultTab === 'messages'
                    ? 'text-white border-[#0078D4] bg-[#1E1E1E]'
                    : 'text-stone-400 border-transparent hover:text-stone-200'
                }`}
              >
                <Info className="w-3.5 h-3.5" />
                <span>Messages</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveResultTab('guide')}
                className={`px-4 py-2 font-medium border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  activeResultTab === 'guide'
                    ? 'text-white border-[#0078D4] bg-[#1E1E1E]'
                    : 'text-stone-400 border-transparent hover:text-stone-200'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Инструкция за свързване към SSMS</span>
              </button>
            </div>

            {queryResult && (
              <div className="text-[11px] text-stone-400 font-mono pr-2 hidden sm:block tabular-nums">
                Време: {queryResult.executionTimeMs} ms · Редове: {queryResult.rowCount}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-auto p-3">
            {activeResultTab === 'results' && (
              <div className="h-full">
                {queryResult && queryResult.rows.length > 0 ? (
                  <div className="overflow-x-auto border border-[#3E3E42] rounded bg-[#1E1E1E]">
                    <table className="w-full text-left font-mono text-[11px] border-collapse">
                      <thead>
                        <tr className="bg-[#2D2D30] text-stone-200 border-b border-[#3E3E42]">
                          <th className="p-2 border-r border-[#3E3E42] text-stone-500 w-12 text-center select-none">
                            #
                          </th>
                          {queryResult.columns.map((col) => (
                            <th
                              key={col}
                              className="p-2 border-r border-[#3E3E42] font-semibold text-blue-300 whitespace-nowrap"
                            >
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {queryResult.rows.map((row, rIdx) => (
                          <tr
                            key={rIdx}
                            className={`border-b border-[#2D2D30] hover:bg-[#2A2D2E] transition-colors ${
                              rIdx % 2 === 0 ? 'bg-[#1E1E1E]' : 'bg-[#1A1A1A]'
                            }`}
                          >
                            <td className="p-2 border-r border-[#3E3E42] text-stone-500 text-center select-none tabular-nums">
                              {rIdx + 1}
                            </td>
                            {queryResult.columns.map((col) => {
                              const val = row[col];
                              return (
                                <td
                                  key={col}
                                  className="p-2 border-r border-[#3E3E42] text-stone-300 max-w-xs truncate"
                                  title={String(val ?? 'NULL')}
                                >
                                  {val === null || val === undefined ? (
                                    <span className="text-amber-500 italic">NULL</span>
                                  ) : col === 'ImageUrl' ? (
                                    <span className="text-blue-400 underline">{String(val)}</span>
                                  ) : typeof val === 'boolean' || col === 'IsFeatured' ? (
                                    <span
                                      className={
                                        val ? 'text-emerald-400 font-bold' : 'text-stone-500'
                                      }
                                    >
                                      {val ? '1 (TRUE)' : '0 (FALSE)'}
                                    </span>
                                  ) : (
                                    String(val)
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-8 text-center text-stone-500 text-xs">
                    {isExecuting
                      ? 'Изпълнение на заявката към базата данни...'
                      : 'Няма намерени резултати за тази заявка.'}
                  </div>
                )}
              </div>
            )}

            {activeResultTab === 'messages' && (
              <div className="font-mono text-xs space-y-2 p-3 bg-[#141414] rounded border border-[#333333]">
                <div className="text-emerald-400 font-semibold">
                  (Command(s) completed successfully.)
                </div>
                <div className="text-stone-300">
                  {queryResult?.messages || 'Заявката се изпълни успешно.'}
                </div>
                <div className="text-stone-500 text-[11px] pt-2 border-t border-[#2A2A2A]">
                  Completion time: {new Date().toISOString()} | Target Database: [BulgariaTravel] | Engine: Microsoft SQL Server 2022
                </div>
              </div>
            )}

            {activeResultTab === 'guide' && (
              <div className="max-w-4xl space-y-6 text-xs text-stone-300 leading-relaxed p-4 bg-[#252526] rounded-xl border border-[#3E3E42]">
                <div className="flex items-center gap-2 border-b border-[#3E3E42] pb-3">
                  <Database className="w-5 h-5 text-blue-400" />
                  <div>
                    <h3 className="font-semibold text-sm text-white">
                      Как да заредите и управлявате базата данни в SQL Server Management Studio (SSMS)
                    </h3>
                    <p className="text-[11px] text-stone-400">
                      Ръководство стъпка по стъпка за работа с Microsoft SQL Server на локална или облачна инстанция.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-3 bg-[#1E1E1E] rounded-lg border border-[#3E3E42] space-y-2">
                    <div className="w-6 h-6 rounded bg-[#0078D4] text-white flex items-center justify-center font-bold text-xs">
                      1
                    </div>
                    <div className="font-semibold text-white">Свалете .SQL скрипта</div>
                    <p className="text-[11px] text-stone-400">
                      Натиснете бутона <strong>„Свали .SQL за SSMS“</strong>, за да изтеглите пълния скрипт <code>BulgariaTravel_SSMS.sql</code>.
                    </p>
                  </div>

                  <div className="p-3 bg-[#1E1E1E] rounded-lg border border-[#3E3E42] space-y-2">
                    <div className="w-6 h-6 rounded bg-[#0078D4] text-white flex items-center justify-center font-bold text-xs">
                      2
                    </div>
                    <div className="font-semibold text-white">Отворете в SSMS</div>
                    <p className="text-[11px] text-stone-400">
                      Стартирайте <strong>SQL Server Management Studio</strong>, изберете <code>File &gt; Open &gt; File...</code> и посочете сваления файл.
                    </p>
                  </div>

                  <div className="p-3 bg-[#1E1E1E] rounded-lg border border-[#3E3E42] space-y-2">
                    <div className="w-6 h-6 rounded bg-[#0078D4] text-white flex items-center justify-center font-bold text-xs">
                      3
                    </div>
                    <div className="font-semibold text-white">Изпълнете (Execute)</div>
                    <p className="text-[11px] text-stone-400">
                      Скриптът създава базата <code>BulgariaTravel</code>, таблиците, изгледите, <code>GEOGRAPHY</code> пространствените индекси и всички {placesRowCount} локации.
                    </p>
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <h4 className="font-semibold text-white text-xs">
                    Препоръчителни низове за връзка (Connection Strings)
                  </h4>
                  <div className="space-y-2 font-mono text-[11px]">
                    <div className="p-2.5 bg-[#141414] rounded border border-[#333333]">
                      <div className="text-stone-400 text-[10px] uppercase font-semibold mb-1">
                        Windows Authentication (Localhost / SSMS default):
                      </div>
                      <div className="text-emerald-400 select-all">
                        Server=localhost;Database=BulgariaTravel;Trusted_Connection=True;TrustServerCertificate=True;
                      </div>
                    </div>

                    <div className="p-2.5 bg-[#141414] rounded border border-[#333333]">
                      <div className="text-stone-400 text-[10px] uppercase font-semibold mb-1">
                        SQL Server Express LocalDB:
                      </div>
                      <div className="text-emerald-400 select-all">
                        Server=(localdb)\MSSQLLocalDB;Database=BulgariaTravel;Trusted_Connection=True;
                      </div>
                    </div>

                    <div className="p-2.5 bg-[#141414] rounded border border-[#333333]">
                      <div className="text-stone-400 text-[10px] uppercase font-semibold mb-1">
                        Entity Framework Core / C# appsettings.json:
                      </div>
                      <div className="text-emerald-400 select-all">
                        "BulgariaTravelDb": "Server=localhost;Database=BulgariaTravel;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=true"
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
