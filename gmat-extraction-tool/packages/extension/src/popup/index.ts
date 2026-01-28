
// Bridge to background for auth
async function sendMessage(message: any) {
    return new Promise<any>((resolve) => {
        chrome.runtime.sendMessage(message, resolve);
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    const loginView = document.getElementById('login-view')!;
    const mainView = document.getElementById('main-view')!;
    const btnLogin = document.getElementById('btn-login')!;
    const btnLogout = document.getElementById('btn-logout')!;
    const btnOpenSidebar = document.getElementById('btn-open-sidebar')!;
    const userEmail = document.getElementById('user-email')!;
    const statusEl = document.getElementById('status')!;

    async function checkAuth() {
        statusEl.textContent = 'Checking status...';
        try {
            const response = await sendMessage({ action: 'GET_TOKEN', interactive: false });
            if (response && response.token) {
                showMainView(response.token);
            } else {
                showLoginView();
            }
        } catch (e) {
            showLoginView();
        }
    }

    function showLoginView() {
        loginView.classList.remove('hidden');
        mainView.classList.add('hidden');
        statusEl.textContent = '';
    }

    async function showMainView(token: string) {
        loginView.classList.add('hidden');
        mainView.classList.remove('hidden');
        statusEl.textContent = '';

        // Get profile info if possible (requires 'profile' scope and extra call)
        // For now just show "Signed In"
        userEmail.textContent = "User";
        // If we wanted email we would need to call Google People API or similar with the token, 
        // or use chrome.identity.getProfileUserInfo (if declared in permissions)

        chrome.identity.getProfileUserInfo((userInfo) => {
            if (userInfo.email) {
                userEmail.textContent = userInfo.email;
            }
        });
    }

    btnLogin.addEventListener('click', async () => {
        statusEl.textContent = 'Signing in...';
        const response = await sendMessage({ action: 'GET_TOKEN', interactive: true });
        if (response && response.token) {
            showMainView(response.token);
        } else {
            statusEl.textContent = 'Sign in failed.';
        }
    });

    btnLogout.addEventListener('click', async () => {
        await sendMessage({ action: 'LOGOUT' });
        showLoginView();
    });

    btnOpenSidebar.addEventListener('click', () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs[0];
            if (tab && tab.id) {
                // We can re-inject content script or send message to it
                // Sending message to content script to open sidebar?
                // Content script already runs on load.
                // Is there a way to trigger sidebar open if it's closed?
                // Sidebar UI adds a global window element.

                chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: () => {
                        // Check if sidebar controls are available globally or we rely on the injected script
                        // The injected script runs createSidebar().
                        // If we want to re-open, we might need to expose a function on window.
                        // For now, let's just reload the page or alert.
                        alert('Sidebar should be active on supported pages.');
                    }
                });
            }
        });
    });

    // Initial check
    checkAuth();
});
