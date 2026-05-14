// js/tour.js — App Tour using Driver.js
export function initTour() {
    const tourDone = localStorage.getItem('mindwave_tour_done');
    if (tourDone) return; // Skip if already completed

    // Ensure Driver is available
    if (!window.driver) {
        console.warn('Driver.js not loaded. Skipping tour.');
        return;
    }

    const driverObj = window.driver.js.driver({
        showProgress: true,
        steps: [
            {
                element: '#tour-voice',
                popover: {
                    title: '1. Voice Capture',
                    description: 'Start here. Speak your raw ideas into the mic. We use Groq Whisper for near-instant, perfect transcription.',
                    side: "right", 
                    align: 'start'
                }
            },
            {
                element: '#tour-passport',
                popover: {
                    title: '2. AI Passport',
                    description: 'Your identity block. Define your role and style once, and we automatically inject it into every prompt.',
                    side: "right", 
                    align: 'start'
                }
            },
            {
                element: '#tour-sync',
                popover: {
                    title: '3. Session Sync',
                    description: 'Moving from ChatGPT to Claude? Paste your history here to carry the context forward seamlessly.',
                    side: "right", 
                    align: 'start'
                }
            },
            {
                element: '#tour-modes',
                popover: {
                    title: 'Memory Modes',
                    description: 'Isolate your contexts. Switch between Founder, Coding, or Study mode so AI never confuses your projects.',
                    side: "bottom", 
                    align: 'start'
                }
            }
        ],
        onDestroyStarted: () => {
            if (!driverObj.hasNextStep() || confirm("Are you sure you want to skip the tour?")) {
                driverObj.destroy();
                localStorage.setItem('mindwave_tour_done', 'true');
            }
        },
    });

    // Short delay to ensure UI is fully rendered
    setTimeout(() => {
        driverObj.drive();
    }, 500);
}
