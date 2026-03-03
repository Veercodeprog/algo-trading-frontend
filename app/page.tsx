"use client";
import { useEffect, useState } from "react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

export default function Home() {
  const [connected, setConnected] = useState(false);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const s = await fetch(`${API_BASE}/api/auth/status`);
      const sj = await s.json();
      setConnected(!!sj.connected);

      if (sj.connected) {
        const p = await fetch(`${API_BASE}/api/profile`);
        setProfile(await p.json());
      }
    })();
  }, []);

  const handleConnect = () => {
    window.location.href = `${API_BASE}/auth/kite/login`;
  };

  const handlePlaceMarketOrder = async () => {
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

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 p-4">
      <h1 className="text-3xl font-bold">My Kite Algo App</h1>

      <div className="text-sm">
        Status: {connected ? "Connected" : "Not connected"}
      </div>

      {profile && (
        <pre className="text-xs bg-gray-100 p-2 rounded max-w-xl overflow-auto">
          {JSON.stringify(profile, null, 2)}
        </pre>
      )}

      <div className="flex gap-3">
        <button
          onClick={handleConnect}
          className="px-4 py-2 rounded bg-blue-600 text-white"
        >
          Connect with Kite
        </button>

        <button
          onClick={handlePlaceMarketOrder}
          className="px-4 py-2 rounded bg-green-600 text-white"
          disabled={!connected}
        >
          Place Market Order
        </button>
      </div>
    </main>
  );
}
