// js/trial.js — 14-Day Free Trial Tracker

const TRIAL_DAYS = 14;
const TRIAL_KEY = 'kairo_trial_start';

export function checkTrialStatus() {
  let startStr = localStorage.getItem(TRIAL_KEY);
  if (!startStr) {
    startStr = new Date().toISOString();
    localStorage.setItem(TRIAL_KEY, startStr);
  }

  const startDate = new Date(startStr);
  const now = new Date();
  
  const diffTime = Math.abs(now - startDate);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
  
  return {
    isExpired: diffDays > TRIAL_DAYS,
    daysLeft: Math.max(0, TRIAL_DAYS - diffDays)
  };
}

export function enforceTrial(modalEl) {
  const status = checkTrialStatus();
  if (status.isExpired) {
    if (modalEl) {
      modalEl.classList.remove('hidden');
    }
    return true; // Trial expired
  }
  return false; // Trial active
}
