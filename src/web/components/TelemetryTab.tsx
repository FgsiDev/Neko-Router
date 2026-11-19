import React, { useState, useEffect } from "react";
import {
 Activity,
 Search,
 RefreshCw,
 Radio,
 Sparkles,
 Copy,
 Check,
 Loader2,
} from "lucide-react";
import { apiRequest, type TelemetryLogItem, type UpstreamKeyItem } from "../lib/api";
import { ToolLogsSection } from "./ToolLogsSection";

export const TelemetryTab: React.FC = () => {
 const [logs, setLogs] = useState<TelemetryLogItem[]>([]);
 const [upstreams, setUpstreams] = useState<UpstreamKeyItem[]>([]);
 const [loading, setLoading] = useState(true);
 const [selectedLog, setSelectedLog] = useState<TelemetryLogItem | null>(null);
 const [copiedId, setCopiedId] = useState(false);
 const [toolRefreshKey, setToolRefreshKey] = useState(0);
 const [activeSection, setActiveSection] = useState<"requests" | "tools">(() => {
 if (typeof window !== "undefined") {
 const saved = localStorage.getItem("neko_telemetry_section");
 if (saved === "tools" || saved === "requests") return saved;
 }
 return "requests";
 });

 const setActiveSectionPersisted = (section: "requests" | "tools") => {
 setActiveSection(section);
 try {
 localStorage.setItem("neko_telemetry_section", section);
 } catch {}
 };

  const loadLogs = async () => {
    setLoading(true);
    try {
      const [logsData, upstreamsData] = await Promise.all([
        apiRequest<{ logs: TelemetryLogItem[] }>("/api/telemetry/logs?limit=50").catch(() => ({ logs: [] })),
        apiRequest<{ upstreams: UpstreamKeyItem[] }>("/api/upstreams").catch(() => ({ upstreams: [] })),
      ]);
      setLogs(logsData.logs || []);
      if (upstreamsData?.upstreams) setUpstreams(upstreamsData.upstreams);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const isAccountUpstream = (up?: UpstreamKeyItem | null) => {
    if (!up) return false;
    const name = (up.name || "").toLowerCase();
    const base = (up.baseUrl || "").toLowerCase();
    const id = (up.id || "").toLowerCase();
    return (
      name.includes("copilot") || base.includes("githubcopilot.com") || id.includes("copilot") ||
      name.includes("antigravity") || base.includes("cloudcode-pa.googleapis.com") || id.includes("antigravity") ||
      name.includes("codex") || base.includes("chatgpt.com/backend-api/codex") || id.includes("codex")
    );
  };

  const getRouteInfo = (log: TelemetryLogItem) => {
    const up = log.upstreamKeyId ? upstreams.find((u) => u.id === log.upstreamKeyId) : null;
    const unit = isAccountUpstream(up) ? "Account" : "Key";
    const groups = up?.apiGroups && up.apiGroups.length > 0 ? up.apiGroups : null;

    if (groups) {
      if (log.upstreamGroupId) {
        const gIdx = groups.findIndex((g) => g.id === log.upstreamGroupId);
        if (gIdx >= 0) {
          const group = groups[gIdx];
          if (group) {
            let kIdx = -1;
            if (log.selectedKeyId) {
              kIdx = (group.keyEntries || []).findIndex((k) => k.id === log.selectedKeyId);
            }
            const label = kIdx >= 0 ? `API #${gIdx + 1} (${unit} #${kIdx + 1})` : `API #${gIdx + 1}`;
            return { label, upstreamName: up?.name || null, approximate: false };
          }
        }
      }
      // Multi API upstream but group/key not recorded for this log (older request)
      return { label: "Multi API", upstreamName: up?.name || null, approximate: true };
    }

    // Log recorded with multi-api group info but upstream/groups not resolvable now
    if (log.upstreamGroupId) {
      return { label: "Multi API", upstreamName: up?.name || null, approximate: true };
    }

    // Multi base-URL pool (legacy/baseUrls) upstream: derive marker from recorded baseUrl/key
    const baseUrls = up?.baseUrls || [];
    if (baseUrls.length > 1) {
      let apiIdx = -1;
      if (log.baseUrl) {
        const norm = (s: string) => s.replace(/\/+$/, "");
        apiIdx = baseUrls.findIndex((b) => norm(b) === norm(log.baseUrl!));
      }
      let kIdx = -1;
      if (log.selectedKeyId) {
        kIdx = (up?.keyEntries || []).findIndex((k) => k.id === log.selectedKeyId);
      }
      if (apiIdx >= 0 || kIdx >= 0) {
        const apiLabel = apiIdx >= 0 ? `API #${apiIdx + 1}` : "API #?";
        const label = kIdx >= 0 ? `${apiLabel} (${unit} #${kIdx + 1})` : apiLabel;
        return { label, upstreamName: up?.name || null, approximate: apiIdx < 0 || kIdx < 0 };
      }
      return { label: "Multi API", upstreamName: up?.name || null, approximate: true };
    }

    return null;
  };

 useEffect(() => {
 loadLogs();
 const interval = setInterval(loadLogs, 8000);
 return () => clearInterval(interval);
 }, []);

 const handleRefresh = () => {
 if (activeSection === "requests") {
 loadLogs();
 } else {
 setToolRefreshKey((value) => value + 1);
 }
 };

 const handleCopyLogId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  if (loading && logs.length === 0 && activeSection === "requests") {
    return (
      <div className="flex items-center justify-center py-24 text-zinc-500 dark:text-zinc-400">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Refresh */}
 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
 <div>
 <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
 Live Telemetry Logs
 </h2>
 <p className="text-xs text-zinc-500 dark:text-zinc-400">
 Inspect AI request telemetry plus search and fetch tool activity.
 </p>
 </div>
 <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
 <div className="flex items-center p-0.5 rounded-md skeuo-inset text-xs">
 {(["requests", "tools"] as const).map((section) => (
 <button
 key={section}
 type="button"
 onClick={() => setActiveSectionPersisted(section)}
 className={`inline-flex items-center px-2.5 py-1 rounded transition-all font-medium cursor-pointer ${
 activeSection === section
 ? "skeuo-btn text-zinc-900 dark:text-zinc-100 font-semibold shadow-xs"
 : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
 }`}
 >
 {section === "requests" ? (
 <Activity className="w-3 h-3 mr-1" />
 ) : (
 <Search className="w-3 h-3 mr-1" />
 )}
 {section === "requests" ? "Request Logs" : "Search & Fetch"}
 </button>
 ))}
 </div>
 <button
 onClick={handleRefresh}
 disabled={activeSection === "requests" && loading}
 className="skeuo-btn inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium rounded-md"
 >
 <RefreshCw
 className={`w-3.5 h-3.5 ${
 activeSection === "requests" && loading ? "animate-spin" : ""
 }`}
 />
 <span>Refresh Logs</span>
 </button>
 </div>
 </div>

 {activeSection === "requests" ? (
 <>
 {/* Logs Table */}
 <div className="skeuo-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 font-medium">
              <tr>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Client Key</th>
                <th className="px-4 py-3">Provider & Model</th>
                <th className="px-4 py-3">Mode</th>
                <th className="px-4 py-3">Prompt</th>
                <th className="px-4 py-3">Cached</th>
                <th className="px-4 py-3">Completion</th>
                <th className="px-4 py-3">Total Tokens</th>
                <th className="px-4 py-3">Latency</th>
                <th className="px-4 py-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200/50 dark:divide-zinc-800/50 text-zinc-700 dark:text-zinc-300">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-zinc-500 dark:text-zinc-400">
                    <Activity className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="font-medium">No request telemetry recorded yet</p>
                    <p className="text-[11px] mt-1">
                      Send a request to <code className="font-mono text-zinc-700 dark:text-zinc-300">/v1/chat/completions</code> or <code className="font-mono text-zinc-700 dark:text-zinc-300">/v1/messages</code> to see logs here.
                    </p>
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const isOk = log.statusCode >= 200 && log.statusCode < 300;
                  const isWarning = log.statusCode >= 400 && log.statusCode < 500;
                  return (
                    <tr
                      key={log.id}
                      onClick={() => setSelectedLog(log)}
                      className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400 whitespace-nowrap text-[11px]">
                        {new Date(log.createdAt).toLocaleTimeString()}
                      </td>
                      <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                        {log.clientKeyName || (
                          <span className="text-zinc-400 italic">Anonymous</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-1.5">
                          <span
                            className={`text-[9px] px-1 py-0.2 rounded font-bold uppercase ${
                              log.provider === "openai"
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            }`}
                          >
                            {log.provider}
                          </span>
                          <span className="font-mono text-[11px] text-zinc-800 dark:text-zinc-200">
                            {log.model}
                          </span>
                        </div>
                        {(() => {
                          const route = getRouteInfo(log);
                          return route ? (
                            <div className="mt-1">
                              <span
                                className="inline-flex text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-mono"
                                title={route.approximate ? `${route.label} (API/key not recorded for this log)` : route.label}
                              >
                                {route.label}
                              </span>
                            </div>
                          ) : null;
                        })()}
                      </td>
                      <td className="px-4 py-3">
                        {log.isStreaming ? (
                          <span className="inline-flex items-center text-[10px] font-medium text-cyan-600 dark:text-cyan-400">
                            <Radio className="w-3 h-3 mr-1" />
                            Stream
                          </span>
                        ) : (
                          <span className="text-[10px] text-zinc-400">JSON</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-zinc-600 dark:text-zinc-400">
                        {log.promptTokens.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 font-mono">
                        {(log.cachedTokens || 0) > 0 ? (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10">
                            <Sparkles className="w-3 h-3 mr-1 shrink-0" />
                            {log.cachedTokens.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-zinc-400 dark:text-zinc-600 text-[11px]">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-zinc-600 dark:text-zinc-400">
                        {log.completionTokens.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 font-mono font-semibold text-zinc-900 dark:text-zinc-100">
                        {log.totalTokens.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400 font-mono text-[11px]">
                        {log.durationMs}ms
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                            isOk
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                              : isWarning
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                              : "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"
                          }`}
                        >
                          {log.statusCode}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log Detail Drawer / Modal */}
      {selectedLog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
          onClick={() => setSelectedLog(null)}
        >
          <div
            className="w-full max-w-lg skeuo-card p-5 sm:p-6 text-xs max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center space-x-3 mb-4 pb-2 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center space-x-1.5">
                <button
                  type="button"
                  onClick={() => setSelectedLog(null)}
                  className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-600 transition-colors inline-block cursor-pointer"
                  title="Close"
                />
                <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
                <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
              </div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Request Telemetry Detail
              </h3>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-md skeuo-card-subtle">
                <div className="min-w-0">
                  <span className="text-zinc-400 block text-[10px] uppercase font-semibold tracking-wider">Log ID</span>
                  <div className="flex items-center space-x-1.5 mt-0.5">
                    <span className="font-mono text-zinc-900 dark:text-zinc-100 break-all select-all text-xs font-semibold">
                      {selectedLog.id}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyLogId(selectedLog.id)}
                      className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 shrink-0 p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                      title="Copy Log ID"
                    >
                      {copiedId ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
                <div className="min-w-0 sm:text-right">
                  <span className="text-zinc-400 block text-[10px] uppercase font-semibold tracking-wider">Timestamp</span>
                  <span className="text-zinc-900 dark:text-zinc-100 text-xs font-mono block mt-0.5">
                    {new Date(selectedLog.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 rounded-md skeuo-card-subtle">
                <div className="min-w-0">
                  <span className="text-zinc-400 block text-[10px] uppercase font-semibold tracking-wider">Endpoint</span>
                  <span className="font-mono text-zinc-900 dark:text-zinc-100 break-all block mt-0.5 font-medium">{selectedLog.endpoint}</span>
                </div>
                <div className="min-w-0">
                  <span className="text-zinc-400 block text-[10px] uppercase font-semibold tracking-wider">Model & Provider</span>
                  <div className="flex items-center space-x-1.5 mt-0.5 flex-wrap">
                    <span
                      className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                        selectedLog.provider === "openai"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                      }`}
                    >
                      {selectedLog.provider}
                    </span>
                    <span className="font-mono text-zinc-900 dark:text-zinc-100 break-all">{selectedLog.model}</span>
                  </div>
                </div>
              </div>

              {(() => {
                const route = getRouteInfo(selectedLog);
                if (!route) return null;
                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 rounded-md skeuo-card-subtle">
                    <div className="min-w-0">
                      <span className="text-zinc-400 block text-[10px] uppercase font-semibold tracking-wider">API Route</span>
                      <span className="inline-flex mt-0.5 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-mono font-semibold">
                        {route.label}
                      </span>
                      {route.approximate && (
                        <span className="block mt-1 text-[10px] text-zinc-500 dark:text-zinc-400">
                          API/key not recorded for this log (older request)
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 sm:text-right">
                      <span className="text-zinc-400 block text-[10px] uppercase font-semibold tracking-wider">Upstream</span>
                      <span className="text-zinc-900 dark:text-zinc-100 font-medium break-all block mt-0.5">
                        {route.upstreamName || selectedLog.upstreamKeyId || "-"}
                      </span>
                    </div>
                  </div>
                );
              })()}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 rounded-md skeuo-card-subtle text-center">
                <div className="min-w-0">
                  <span className="text-zinc-400 block text-[10px] uppercase font-semibold tracking-wider">Prompt</span>
                  <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100 text-xs">{selectedLog.promptTokens.toLocaleString()}</span>
                </div>
                <div className="min-w-0">
                  <span className="text-zinc-400 block text-[10px] uppercase font-semibold tracking-wider">Cached</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                    {(selectedLog.cachedTokens || 0).toLocaleString()}
                  </span>
                </div>
                <div className="min-w-0">
                  <span className="text-zinc-400 block text-[10px] uppercase font-semibold tracking-wider">Completion</span>
                  <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100 text-xs">{selectedLog.completionTokens.toLocaleString()}</span>
                </div>
                <div className="min-w-0">
                  <span className="text-zinc-400 block text-[10px] uppercase font-semibold tracking-wider">Total</span>
                  <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100 text-xs">{selectedLog.totalTokens.toLocaleString()}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 rounded-md skeuo-card-subtle">
                <div className="min-w-0">
                  <span className="text-zinc-400 block text-[10px] uppercase font-semibold tracking-wider">Client Key</span>
                  <span className="text-zinc-900 dark:text-zinc-100 font-medium break-all block mt-0.5">{selectedLog.clientKeyName || "Anonymous"}</span>
                </div>
                <div className="min-w-0 sm:text-right">
                  <span className="text-zinc-400 block text-[10px] uppercase font-semibold tracking-wider">Latency Duration</span>
                  <span className="font-mono text-zinc-900 dark:text-zinc-100 block mt-0.5">{selectedLog.durationMs} ms</span>
                </div>
              </div>

              {selectedLog.errorMessage && (
                <div className="p-3 rounded-md bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400">
                  <span className="font-semibold block mb-1">Upstream Error:</span>
                  <pre className="text-[11px] whitespace-pre-wrap break-all font-mono max-h-48 overflow-y-auto">{selectedLog.errorMessage}</pre>
                </div>
              )}
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="skeuo-btn-primary px-4 py-2 rounded-md"
              >
                Close
              </button>
            </div>
 </div>
 </div>
 )}
 </>
 ) : (
 <ToolLogsSection refreshKey={toolRefreshKey} />
 )}
 </div>
 );
};
