// js/session-sync.js — Session Sync API and Logic

export async function generateSessionSync(rawText) {
  const res = await fetch('/api/session-sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: rawText })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Server error ${res.status}`);
  }

  const data = await res.json();
  return data.result || '';
}
