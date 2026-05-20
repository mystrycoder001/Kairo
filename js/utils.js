// js/utils.js — Global shared utilities

export const $ = (id) => document.getElementById(id);

export function showToast(msg) {
  const toast = $('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.remove('opacity-0', 'translate-y-20');
  setTimeout(() => toast.classList.add('opacity-0', 'translate-y-20'), 3000);
}

export function logError(component, error) {
  console.error(`[Cloasta] ${component}:`, error?.message || error);
}

export function cleanPrompt(text) {
  if (!text) return '';
  return text.replace(/\*\*/g,'').replace(/\*/g,'').replace(/#{1,6}\s/g,'').replace(/`{1,3}/g,'').replace(/^\s*[-•]\s/gm,'').trim();
}
