"use client";

import { useEffect, useMemo, useState } from "react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

type QuoteKind = "ltp" | "ohlc" | "full";

export default function Home() {
  // --- Auth + profile ---
  const [connected, setConnected] = useState(false);
  const [authErr, setAuthErr] = useState<string | null>(null);

  const [profile, setProfile] = useState<any>(null);
  const [profileErr, setProfileErr] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // --- Margins ---
  const [margins, setMargins] = useState<any>(null);
  const [marginsErr, setMarginsErr] = useState<string | null>(null);
  const [marginsLoading, setMarginsLoading] = useState(false);
  const [marginsSegment, setMarginsSegment] = useState<
    "all" | "equity" | "commodity"
  >("all");

  // --- Instruments: sync/list/search ---
  const [exchange, setExchange] = useState("NSE");

  const [instPage, setInstPage] = useState<any>(null);
  const [instPageErr, setInstPageErr] = useState<string | null>(null);
  const [instPageLoading, setInstPageLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit] = useState(25);

  const [searchQ, setSearchQ] = useState("INF");
  const [searchResults, setSearchResults] = useState<any[] | null>(null);
  const [searchErr, setSearchErr] = useState<string | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);

  // --- Quotes (watchlist) ---
  const [watchInput, setWatchInput] = useState("NSE:INFY");
  const [watchlist, setWatchlist] = useState<string[]>(["NSE:INFY"]);
  const [quoteKind, setQuoteKind] = useState<QuoteKind>("ltp");
  const [quoteData, setQuoteData] = useState<any>(null);
  const [quoteErr, setQuoteErr] = useState<string | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);

  // ---- helpers ----
  const fetchJson = async (path: string) => {
    const res = await fetch(`${API_BASE}${path}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok)
      throw new Error(data?.message ?? `Request failed: ${res.status}`);
    return data;
  };

  const refreshAuth = async () => {
    setAuthErr(null);
    try {
      const sj = await fetchJson("/api/auth/status");
      setConnected(!!sj.connected);
      return !!sj.connected;
    } catch (e: any) {
      setConnected(false);
      setAuthErr(e.message ?? "Failed to fetch auth status");
      return false;
    }
  };

  const loadProfile = async () => {
    setProfileLoading(true);
    setProfileErr(null);
    try {
      const p = await fetchJson("/api/profile");
      setProfile(p);
    } catch (e: any) {
      setProfile(null);
      setProfileErr(e.message ?? "Failed to load profile");
    } finally {
      setProfileLoading(false);
    }
  };

  const loadMargins = async (seg: "all" | "equity" | "commodity") => {
    if (!connected) return;
    setMarginsSegment(seg);
    setMarginsLoading(true);
    setMarginsErr(null);
    try {
      const path = seg === "all" ? "/api/margins" : `/api/margins/${seg}`;
      const m = await fetchJson(path);
      setMargins(m);
    } catch (e: any) {
      setMargins(null);
      setMarginsErr(e.message ?? "Failed to load margins");
    } finally {
      setMarginsLoading(false);
    }
  };

  const syncInstruments = async () => {
    if (!connected) return alert("Connect first");
    setInstPageErr(null);
    setInstPageLoading(true);
    try {
      // If your backend supports exchange-specific sync, call it; otherwise remove query.
      await fetchJson(
        `/api/instruments/sync?exchange=${encodeURIComponent(exchange)}`,
      ).catch(() => null);
      await loadInstrumentsPage(1);
    } catch (e: any) {
      setInstPageErr(e.message ?? "Failed to sync instruments");
    } finally {
      setInstPageLoading(false);
    }
  };

  const loadInstrumentsPage = async (p: number) => {
    if (!connected) return;
    setInstPageLoading(true);
    setInstPageErr(null);
    try {
      const data = await fetchJson(
        `/api/instruments/list?exchange=${encodeURIComponent(exchange)}&page=${p}&limit=${limit}`,
      );
      setInstPage(data);
      setPage(p);
    } catch (e: any) {
      setInstPage(null);
      setInstPageErr(e.message ?? "Failed to load instruments list");
    } finally {
      setInstPageLoading(false);
    }
  };

  const searchInstruments = async () => {
    if (!connected) return alert("Connect first");
    const q = searchQ.trim();
    if (!q) return alert("Type something to search");

    setSearchLoading(true);
    setSearchErr(null);
    setSearchResults(null);
    try {
      const data = await fetchJson(
        `/api/instruments/search?q=${encodeURIComponent(q)}&exchange=${encodeURIComponent(exchange)}&limit=20`,
      );
      setSearchResults(data?.data ?? []);
    } catch (e: any) {
      setSearchErr(e.message ?? "Search failed");
    } finally {
      setSearchLoading(false);
    }
  };

  const quotePath = useMemo(() => {
    if (quoteKind === "ltp") return "/api/quote/ltp";
    if (quoteKind === "ohlc") return "/api/quote/ohlc";
    return "/api/quote";
  }, [quoteKind]);

  const fetchQuotes = async () => {
    if (!connected) return alert("Connect first");
    if (watchlist.length === 0) return alert("Add at least one instrument");

    setQuoteLoading(true);
    setQuoteErr(null);
    setQuoteData(null);

    try {
      const params = new URLSearchParams();
      watchlist.forEach((x) => params.append("i", x)); // i=NSE:INFY&i=NSE:TCS [web:86]
      const data = await fetchJson(`${quotePath}?${params.toString()}`);
      setQuoteData(data);
    } catch (e: any) {
      setQuoteErr(e.message ?? "Failed to fetch quotes");
    } finally {
      setQuoteLoading(false);
    }
  };

  const addWatch = (value: string) => {
    const v = value.trim().toUpperCase();
    if (!v) return;
    if (!v.includes(":")) return alert("Use format like NSE:INFY");
    setWatchlist((prev) => (prev.includes(v) ? prev : [...prev, v]));
  };

  const removeWatch = (value: string) => {
    setWatchlist((prev) => prev.filter((x) => x !== value));
  };

  const handleConnect = () => {
    window.location.href = `${API_BASE}/auth/kite/login`;
  };

  const handlePlaceMarketOrder = async () => {
    if (!connected) return alert("Connect first");
    const res = await fetch(`${API_BASE}/api/orders/regular`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tradingsymbol: "INFY",
        exchange: "NSE",
        transaction_type: "BUY",
        quantity: 1,
        order_type: "MARKET",
        product: "CNC",
      }),
    });
    const data = await res.json();
    alert(JSON.stringify(data));
  };

  // --- initial load ---
  useEffect(() => {
    (async () => {
      const ok = await refreshAuth();
      if (ok) {
        await loadProfile();
        await loadMargins("all");
        await loadInstrumentsPage(1);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- computed display helpers ---
  const caps = profile?.data ?? null; // Kite profile commonly wraps fields inside data. [web:1]
  const m = margins?.data ?? null;

  const instRows: any[] = instPage?.data ?? [];
  const quoteMap = quoteData?.data ?? {};

  return (
    <main className="min-h-screen p-6 bg-gray-50">
      <div className="max-w-5xl mx-auto space-y-4">
        <h1 className="text-3xl font-bold">My Kite Algo App</h1>

        <div className="text-sm">
          Status:{" "}
          <span className={connected ? "text-green-700" : "text-red-700"}>
            {connected ? "Connected" : "Not connected"}
          </span>
        </div>

        {authErr && <p className="text-sm text-red-600">{authErr}</p>}

        <div className="flex gap-2 flex-wrap">
          <button
            onClick={handleConnect}
            className="px-4 py-2 rounded bg-blue-600 text-white"
          >
            Connect with Kite
          </button>

          <button
            onClick={handlePlaceMarketOrder}
            className="px-4 py-2 rounded bg-green-600 text-white disabled:opacity-50"
            disabled={!connected}
          >
            Place Market Order
          </button>

          <button
            onClick={async () => {
              const ok = await refreshAuth();
              if (ok) {
                await loadProfile();
                await loadMargins(marginsSegment);
                await loadInstrumentsPage(page);
              }
            }}
            className="px-4 py-2 rounded bg-gray-900 text-white"
          >
            Refresh all
          </button>
        </div>

        {/* Profile */}
        <section className="bg-white border rounded p-4 space-y-3">
          <h2 className="text-lg font-semibold">Profile / Capabilities</h2>

          {profileLoading && <p className="text-sm">Loading profile…</p>}
          {profileErr && <p className="text-sm text-red-600">{profileErr}</p>}

          {caps && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                <Stat label="User" value={caps.user_name ?? "-"} />
                <Stat label="User ID" value={caps.user_id ?? "-"} />
                <Stat label="Broker" value={caps.broker ?? "-"} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                <Stat
                  label="Exchanges"
                  value={
                    Array.isArray(caps.exchanges)
                      ? caps.exchanges.join(", ")
                      : "-"
                  }
                />
                <Stat
                  label="Products"
                  value={
                    Array.isArray(caps.products)
                      ? caps.products.join(", ")
                      : "-"
                  }
                />
                <Stat
                  label="Order types"
                  value={
                    Array.isArray(caps.order_types)
                      ? caps.order_types.join(", ")
                      : "-"
                  }
                />
              </div>

              <details>
                <summary className="cursor-pointer text-sm text-gray-700">
                  Raw /api/profile
                </summary>
                <pre className="text-xs bg-gray-100 p-2 rounded mt-2 overflow-auto max-h-[240px]">
                  {JSON.stringify(profile, null, 2)}
                </pre>
              </details>
            </>
          )}
        </section>

        {/* Margins */}
        <section className="bg-white border rounded p-4 space-y-3">
          <h2 className="text-lg font-semibold">Funds & Margins</h2>

          <div className="flex gap-2 flex-wrap items-center">
            <button
              className={`px-3 py-2 rounded text-white ${marginsSegment === "all" ? "bg-gray-900" : "bg-gray-700"}`}
              disabled={!connected || marginsLoading}
              onClick={() => loadMargins("all")}
            >
              All
            </button>
            <button
              className={`px-3 py-2 rounded text-white ${marginsSegment === "equity" ? "bg-blue-700" : "bg-blue-600"}`}
              disabled={!connected || marginsLoading}
              onClick={() => loadMargins("equity")}
            >
              Equity
            </button>
            <button
              className={`px-3 py-2 rounded text-white ${marginsSegment === "commodity" ? "bg-green-700" : "bg-green-600"}`}
              disabled={!connected || marginsLoading}
              onClick={() => loadMargins("commodity")}
            >
              Commodity
            </button>

            {marginsLoading && <span className="text-sm">Loading…</span>}
            {marginsErr && (
              <span className="text-sm text-red-600">{marginsErr}</span>
            )}
          </div>

          {m && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                <Stat label="Equity cash" value={m?.equity?.available?.cash} />
                <Stat label="Equity net" value={m?.equity?.net} />
                <Stat
                  label="Equity utilised(debits)"
                  value={m?.equity?.utilised?.debits}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                <Stat
                  label="Commodity cash"
                  value={m?.commodity?.available?.cash}
                />
                <Stat label="Commodity net" value={m?.commodity?.net} />
                <Stat
                  label="Commodity utilised(debits)"
                  value={m?.commodity?.utilised?.debits}
                />
              </div>

              <details>
                <summary className="cursor-pointer text-sm text-gray-700">
                  Raw /api/margins
                </summary>
                <pre className="text-xs bg-gray-100 p-2 rounded mt-2 overflow-auto max-h-[240px]">
                  {JSON.stringify(margins, null, 2)}
                </pre>
              </details>
            </>
          )}
        </section>

        {/* Instruments */}
        <section className="bg-white border rounded p-4 space-y-3">
          <h2 className="text-lg font-semibold">Instruments</h2>

          <div className="flex gap-2 flex-wrap items-center">
            <label className="text-sm text-gray-700">Exchange:</label>
            <input
              value={exchange}
              onChange={(e) => setExchange(e.target.value.toUpperCase())}
              className="border rounded px-3 py-2 w-24"
              placeholder="NSE"
            />

            <button
              onClick={() => loadInstrumentsPage(1)}
              className="px-3 py-2 rounded bg-gray-900 text-white disabled:opacity-50"
              disabled={!connected || instPageLoading}
            >
              Load list
            </button>

            <button
              onClick={syncInstruments}
              className="px-3 py-2 rounded bg-gray-700 text-white disabled:opacity-50"
              disabled={!connected || instPageLoading}
              title="Only works if you implemented /api/instruments/sync"
            >
              Sync (optional)
            </button>

            <button
              onClick={() => loadInstrumentsPage(Math.max(1, page - 1))}
              className="px-3 py-2 rounded bg-gray-700 text-white disabled:opacity-50"
              disabled={!connected || instPageLoading || page <= 1}
            >
              Prev
            </button>

            <button
              onClick={() => loadInstrumentsPage(page + 1)}
              className="px-3 py-2 rounded bg-gray-700 text-white disabled:opacity-50"
              disabled={!connected || instPageLoading}
            >
              Next
            </button>

            <span className="text-sm text-gray-600">
              Page {page}, showing {instRows.length}
            </span>
          </div>

          {instPageLoading && <p className="text-sm">Loading instruments…</p>}
          {instPageErr && <p className="text-sm text-red-600">{instPageErr}</p>}

          <div className="flex gap-2 flex-wrap items-center">
            <input
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              className="border rounded px-3 py-2 w-56"
              placeholder="Search e.g. INF, RELIANCE"
            />
            <button
              onClick={searchInstruments}
              className="px-3 py-2 rounded bg-purple-700 text-white disabled:opacity-50"
              disabled={!connected || searchLoading}
            >
              Search
            </button>
            {searchLoading && <span className="text-sm">Searching…</span>}
            {searchErr && (
              <span className="text-sm text-red-600">{searchErr}</span>
            )}
          </div>

          {Array.isArray(searchResults) && (
            <div className="border rounded bg-gray-50 p-2">
              <div className="text-sm text-gray-700 mb-2">
                Search results (click to add to watchlist):
              </div>
              <div className="flex flex-wrap gap-2">
                {searchResults.map((r, idx) => {
                  const key = `${r.exchange}:${r.tradingsymbol}`;
                  return (
                    <button
                      key={`${key}-${idx}`}
                      className="text-xs px-2 py-1 rounded bg-white border hover:bg-gray-100"
                      onClick={() => addWatch(key)}
                      title="Add to watchlist"
                    >
                      {key} — {r.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <details>
            <summary className="cursor-pointer text-sm text-gray-700">
              Raw /api/instruments/list
            </summary>
            <pre className="text-xs bg-gray-100 p-2 rounded mt-2 overflow-auto max-h-[240px]">
              {JSON.stringify(instPage, null, 2)}
            </pre>
          </details>
        </section>

        {/* Quotes */}
        <section className="bg-white border rounded p-4 space-y-3">
          <h2 className="text-lg font-semibold">Quotes (LTP / OHLC / FULL)</h2>

          <div className="flex gap-2 flex-wrap items-center">
            <input
              value={watchInput}
              onChange={(e) => setWatchInput(e.target.value)}
              className="border rounded px-3 py-2 w-56"
              placeholder="NSE:INFY"
            />
            <button
              onClick={() => addWatch(watchInput)}
              className="px-3 py-2 rounded bg-gray-900 text-white"
            >
              Add
            </button>

            <select
              value={quoteKind}
              onChange={(e) => setQuoteKind(e.target.value as QuoteKind)}
              className="border rounded px-3 py-2"
            >
              <option value="ltp">LTP</option>
              <option value="ohlc">OHLC</option>
              <option value="full">FULL quote</option>
            </select>

            <button
              onClick={fetchQuotes}
              className="px-3 py-2 rounded bg-blue-700 text-white disabled:opacity-50"
              disabled={!connected || quoteLoading}
            >
              Fetch quotes
            </button>

            {quoteLoading && <span className="text-sm">Fetching…</span>}
            {quoteErr && (
              <span className="text-sm text-red-600">{quoteErr}</span>
            )}
          </div>

          <div className="text-sm text-gray-700">
            Watchlist ({watchlist.length}) — click a chip to remove:
          </div>
          <div className="flex flex-wrap gap-2">
            {watchlist.map((x) => (
              <button
                key={x}
                onClick={() => removeWatch(x)}
                className="text-xs px-2 py-1 rounded bg-gray-100 border hover:bg-gray-200"
                title="Remove"
              >
                {x}
              </button>
            ))}
          </div>

          {/* Simple table view */}
          <div className="overflow-auto">
            <table className="min-w-full text-sm border">
              <thead className="bg-gray-100">
                <tr>
                  <th className="text-left p-2 border">Instrument</th>
                  <th className="text-left p-2 border">LTP</th>
                  <th className="text-left p-2 border">OHLC</th>
                  <th className="text-left p-2 border">Token</th>
                </tr>
              </thead>
              <tbody>
                {watchlist.map((key) => {
                  const q = quoteMap?.[key]; // response map keyed by exchange:tradingsymbol. [web:86]
                  const ltp = q?.last_price;
                  const ohlc = q?.ohlc;
                  const token = q?.instrument_token;
                  return (
                    <tr key={key}>
                      <td className="p-2 border font-mono">{key}</td>
                      <td className="p-2 border font-mono">{ltp ?? "-"}</td>
                      <td className="p-2 border font-mono">
                        {ohlc
                          ? `${ohlc.open} / ${ohlc.high} / ${ohlc.low} / ${ohlc.close}`
                          : "-"}
                      </td>
                      <td className="p-2 border font-mono">{token ?? "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <details>
            <summary className="cursor-pointer text-sm text-gray-700">
              Raw quote JSON
            </summary>
            <pre className="text-xs bg-gray-100 p-2 rounded mt-2 overflow-auto max-h-[260px]">
              {JSON.stringify(quoteData, null, 2)}
            </pre>
          </details>
        </section>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div className="border rounded p-2 bg-gray-50">
      <div className="text-gray-500">{label}</div>
      <div className="font-mono break-all">{value ?? "-"}</div>
    </div>
  );
}
