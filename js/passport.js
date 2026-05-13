// passport.js — AI Passport form logic & localStorage

const STORAGE_KEY = 'kairo_passport';

export function savePassport(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function loadPassport() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function getPassportText() {
  return localStorage.getItem('kairo_passport_text') || '';
}

export function savePassportText(text) {
  localStorage.setItem('kairo_passport_text', text);
}

export function getPassportFormData() {
  const tools = [...document.querySelectorAll('input[name="ai-tools"]:checked')].map(el => el.value);
  return {
    name:    document.getElementById('passport-name')?.value.trim()  || '',
    age:     document.getElementById('passport-age')?.value.trim()   || '',
    role:    document.getElementById('passport-role')?.value.trim()  || '',
    goals:   document.getElementById('passport-goals')?.value.trim() || '',
    style:   document.getElementById('passport-style')?.value        || '',
    tools,
    context: document.getElementById('passport-context')?.value.trim() || ''
  };
}

export function populateForm(data) {
  if (!data) return;
  if (data.name)  document.getElementById('passport-name').value  = data.name;
  if (data.age)   document.getElementById('passport-age').value   = data.age;
  if (data.role)  document.getElementById('passport-role').value  = data.role;
  if (data.goals) document.getElementById('passport-goals').value = data.goals;
  if (data.style) document.getElementById('passport-style').value = data.style;
  if (data.context) document.getElementById('passport-context').value = data.context;
  if (data.tools?.length) {
    document.querySelectorAll('input[name="ai-tools"]').forEach(cb => {
      cb.checked = data.tools.includes(cb.value);
    });
  }
}

// Session Sync History
const SYNC_HISTORY_KEY = 'kairo_sync_history';

export function getSyncHistory() {
  try {
    const raw = localStorage.getItem(SYNC_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveSyncHistoryItem(text) {
  const history = getSyncHistory();
  history.unshift({
    id: Date.now().toString(),
    time: new Date().toLocaleString(),
    text: text
  });
  // Keep only last 20
  if (history.length > 20) history.length = 20;
  localStorage.setItem(SYNC_HISTORY_KEY, JSON.stringify(history));
}
