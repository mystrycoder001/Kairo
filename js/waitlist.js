import { CONFIG } from './config.js';

// Initialize Supabase Client
const supabase = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

const $ = (id) => document.getElementById(id);

document.addEventListener('DOMContentLoaded', () => {
    const form = $('waitlist-form');
    const emailInput = $('waitlist-email');
    const roleSelect = $('waitlist-role');
    const submitBtn = $('waitlist-submit-btn');
    const successContainer = $('success-container');
    const formContainer = $('form-container');
    const sharingText = $('sharing-text');
    const shareBtn = $('share-twitter-btn');
    
    // Parse URL source/ref parameter if exists (e.g. waitlist.html?ref=twitter)
    const urlParams = new URLSearchParams(window.location.search);
    const source = urlParams.get('ref') || urlParams.get('utm_source') || 'direct';

    function showToast(msg, isError = true) {
        const toast = $('toast');
        if (!toast) return;
        toast.textContent = msg;
        toast.style.borderColor = isError ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.2)';
        toast.style.background = isError ? 'rgba(20, 10, 10, 0.9)' : 'rgba(10, 20, 10, 0.9)';
        toast.classList.remove('opacity-0', 'translate-y-20');
        setTimeout(() => toast.classList.add('opacity-0', 'translate-y-20'), 4000);
    }

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const email = emailInput?.value.trim();
            const role = roleSelect?.value;

            if (!email || !email.includes('@')) {
                showToast('Please enter a valid email address.');
                return;
            }

            if (!role) {
                showToast('Please select your role.');
                return;
            }

            // Disable submit button and show loading state
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = `
                    <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-black inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Securing Spot...</span>
                `;
            }

            try {
                const { data, error } = await supabase
                    .from('cloasta_waitlist')
                    .insert([
                        { 
                            email: email, 
                            role: role, 
                            source: source 
                        }
                    ]);

                if (error) {
                    // Check for duplicate key / already registered
                    if (error.code === '23505') {
                        throw new Error("You are already on the waitlist! We will prioritize your spot.");
                    }
                    throw error;
                }

                // Smooth cinematic transition to success state
                if (formContainer && successContainer) {
                    formContainer.classList.add('opacity-0', 'scale-95');
                    setTimeout(() => {
                        formContainer.classList.add('hidden');
                        successContainer.classList.remove('hidden');
                        // Fade in success elements sequentially
                        setTimeout(() => {
                            successContainer.classList.remove('opacity-0', 'scale-95');
                        }, 50);
                    }, 300);
                }

                // Custom Twitter / X share configuration
                if (shareBtn) {
                    const text = encodeURIComponent("I just secured early access to Cloasta — persistent AI memory & identity across every tool. No more starting from zero again. 🌐🧠\n\nJoin the waitlist here:");
                    const url = encodeURIComponent(window.location.origin + window.location.pathname);
                    shareBtn.setAttribute('href', `https://twitter.com/intent/tweet?text=${text}&url=${url}`);
                }

            } catch (err) {
                // If it's a known "already registered" error, handle it gracefully as success but with warning note
                if (err.message.includes("already on the waitlist")) {
                    showToast(err.message, false);
                    if (formContainer && successContainer) {
                        formContainer.classList.add('opacity-0', 'scale-95');
                        setTimeout(() => {
                            formContainer.classList.add('hidden');
                            successContainer.classList.remove('hidden');
                            if (sharingText) {
                                sharingText.textContent = "You're already registered! Keep sharing with your network for higher priority access.";
                            }
                            setTimeout(() => {
                                successContainer.classList.remove('opacity-0', 'scale-95');
                            }, 50);
                        }, 300);
                    }
                } else {
                    showToast('❌ ' + (err.message || 'Error joining waitlist. Please try again.'));
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = `<span>Get Early Access</span>`;
                    }
                }
            }
        });
    }
});
