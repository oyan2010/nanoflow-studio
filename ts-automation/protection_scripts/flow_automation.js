(function () {
    // Prevent multiple injections
    if (window.VeoFlowAutomation) {
        console.log('[VEO-AUTO] Automation already loaded');
        return;
    }

    console.log('[VEO-AUTO] Loading Automation Script v3.0 (API Integrated)...');

    // ============= state tracking =============
    window.veoState = {
        activeOperations: new Set(),
        processedOperations: new Set(),
        lastSubmissionError: null
    };

    // ============= Fetch Interception =============
    const originalFetch = window.fetch;
    window.originalFetch = originalFetch;

    window.fetch = async function (...args) {
        const response = await originalFetch.apply(this, args);
        try {
            const url = (args[0] && typeof args[0] === 'string') ? args[0] : (args[0] && args[0].url) ? args[0].url : '';

            // Check if this is a Generation Submission (UI Triggered)
            if (url.includes('batchAsyncGenerateVideoText')) {
                console.log('[VEO-AUTO] Intercepted Submission Response');

                // Check for failure
                if (!response.ok) {
                    console.log(`[VEO-AUTO] ✗ Submission FAILED with status ${response.status}`);
                    window.veoState.lastSubmissionError = {
                        status: response.status,
                        time: Date.now()
                    };
                } else {
                    // Clear any previous error
                    window.veoState.lastSubmissionError = null;

                    const clone = response.clone();
                    clone.json().then(data => {
                        if (data.operations && Array.isArray(data.operations)) {
                            data.operations.forEach(op => {
                                if (op.operation && op.operation.name) {
                                    const id = op.operation.name;
                                    console.log(`[VEO-AUTO] Captured new Operation ID: ${id}`);
                                    window.veoState.activeOperations.add(id);
                                }
                            });
                        }
                    }).catch(err => console.error('[VEO-AUTO] Failed to parse submission response', err));
                }
            }

            // Check if this is a Status Check (page's own polling)
            if (url.includes('batchCheckAsyncVideoGenerationStatus')) {
                console.log('[VEO-AUTO] Intercepted Status Check Response');
                const clone = response.clone();
                clone.json().then(async data => {
                    if (data.operations && Array.isArray(data.operations)) {
                        for (const op of data.operations) {
                            const opId = op.operation?.name;
                            const status = op.status;

                            // Skip already processed
                            if (opId && window.veoState.processedOperations.has(opId)) continue;

                            console.log(`[VEO-AUTO] Status for ${opId}: ${status}`);

                            // Check for successful completion
                            if (status === 'MEDIA_GENERATION_STATUS_SUCCESSFUL' || status === 'SUCCESSFUL') {
                                const metadata = op.operation?.metadata?.video;
                                if (metadata && metadata.fifeUrl) {
                                    const downloadUrl = metadata.fifeUrl;
                                    const prompt = metadata.prompt || "veo_video";
                                    const safeName = prompt.replace(/[^a-z0-9]/gi, '_').replace(/_+/g, '_').substring(0, 60);
                                    const filename = safeName + ".mp4";

                                    console.log(`[VEO-AUTO] ✓ Video Ready! Storing URL for Python download: ${filename}`);

                                    // Store URL for Python-based download (avoids CORS issues)
                                    window.veoState.pendingDownloads = window.veoState.pendingDownloads || [];
                                    window.veoState.pendingDownloads.push({
                                        url: downloadUrl,
                                        prompt: prompt,
                                        filename: filename,
                                        opId: opId
                                    });

                                    window.veoState.processedOperations.add(opId);
                                    window.veoState.activeOperations.delete(opId);
                                }
                            } else if (status && (status.includes('FAILED') || status.includes('ERROR'))) {
                                console.log(`[VEO-AUTO] ✗ Generation Failed: ${opId}`);
                                window.veoState.activeOperations.delete(opId);
                            }
                        }
                    }
                }).catch(err => console.error('[VEO-AUTO] Failed to parse status response', err));
            }
        } catch (e) {
            console.error('[VEO-AUTO] Interceptor error', e);
        }
        return response;
    };

    // ============= Configuration =============
    const CONFIG = {
        ELEMENT_WAIT_TIMEOUT: 15000, // 15s wait for elements
        GENERATION_TIMEOUT: 300000,  // 5m wait for generation
        CLICK_DELAY: 500,           // Wait after clicks
        TYPE_DELAY: 50,             // Human-typing speed

        // Mappings for dropdown text
        MODES: {
            'textToVideo': 'Text to Video',
            'imageToVideo': 'Image to Video'
        },
        ASPECT_RATIOS: {
            'landscape': 'Landscape (16:9)',
            'portrait': 'Portrait (9:16)',
            'square': 'Square (1:1)'
        },

        // API Endpoints
        API_ENDPOINTS: {
            SUBMIT: 'batchAsyncGenerateVideoText',
            CHECK: 'batchCheckAsyncVideoGenerationStatus'
        },

        SELECTORS: {
            PROMPT_TEXTAREA: 'textarea[placeholder*="Describe"], textarea[aria-label*="Prompt"], [contenteditable="true"]',
            GENERATE_BUTTON: 'button' // Logic handles finding the right button
        }
    };

    // ============= Utility Functions =============

    /**
     * Sleep helper
     */
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Check visibility
     */
    function isFullyVisible(el) {
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        return (
            rect.width > 0 &&
            rect.height > 0 &&
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth)
        );
    }

    /**
     * Wait for element to appear
     */
    async function waitForElement(selector, timeout = CONFIG.ELEMENT_WAIT_TIMEOUT, checkVisible = true) {
        const startTime = Date.now();
        console.log(`[VEO-AUTO] Waiting for: ${selector}`);

        while (Date.now() - startTime < timeout) {
            // Support direct xpath or complex logic? No, keep simple querySelector for now
            // But support our custom finders
            let elements = [];

            if (selector.startsWith('//')) {
                // XPath support if needed, but avoiding for now
            } else {
                elements = document.querySelectorAll(selector);
            }

            for (const el of elements) {
                if (!checkVisible || isFullyVisible(el)) {
                    await sleep(200); // Stabilization delay
                    return el;
                }
            }

            await sleep(100);
        }

        console.log(`[VEO-AUTO] Element not found: ${selector}`);
        return null;
    }

    /**
     * Find element by icon text (Google Material Icons use text content)
     */
    function findButtonByIcon(iconText) {
        const buttons = document.querySelectorAll('button');
        for (const btn of buttons) {
            const icon = btn.querySelector('i');
            if (icon && icon.textContent && icon.textContent.trim() === iconText) {
                return btn;
            }
        }
        return null;
    }

    /**
     * Click element with full mouse event sequence (from Auto VEO)
     */
    async function clickElement(element) {
        if (!element) {
            console.log('[VEO-AUTO] Cannot click null element');
            return false;
        }

        // Scroll into view if needed
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await sleep(100);

        const rect = element.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;

        const eventOptions = {
            bubbles: true,
            cancelable: true,
            composed: true,
            view: window,
            detail: 1,
            clientX: x,
            clientY: y
        };

        // Full mouse event sequence
        const events = [
            new PointerEvent('pointerover', eventOptions),
            new MouseEvent('mouseover', eventOptions),
            new PointerEvent('pointerdown', { ...eventOptions, button: 0 }),
            new MouseEvent('mousedown', { ...eventOptions, button: 0 }),
            new PointerEvent('pointerup', { ...eventOptions, button: 0 }),
            new MouseEvent('mouseup', { ...eventOptions, button: 0 }),
            new MouseEvent('click', eventOptions)
        ];

        for (const event of events) {
            element.dispatchEvent(event);
        }

        await sleep(CONFIG.CLICK_DELAY);
        return true;
    }

    /**
     * Click element by selector
     */
    async function clickSelector(selector, timeout = CONFIG.ELEMENT_WAIT_TIMEOUT) {
        const element = await waitForElement(selector, timeout);
        if (element) {
            return await clickElement(element);
        }
        return false;
    }

    // ============= Settings Configuration =============

    /**
     * Find and click the settings/tune button
     */
    async function openSettings() {
        console.log('[VEO-AUTO] Opening settings...');

        // Look for button with "tune" icon
        const tuneButton = findButtonByIcon('tune');
        if (tuneButton && isFullyVisible(tuneButton)) {
            await clickElement(tuneButton);
            await sleep(500);
            return true;
        }

        // Fallback: button with aria-haspopup="dialog"
        const buttons = document.querySelectorAll('button[aria-haspopup="dialog"]');
        for (const btn of buttons) {
            if (isFullyVisible(btn)) {
                await clickElement(btn);
                await sleep(500);
                return true;
            }
        }

        console.log('[VEO-AUTO] Settings button not found');
        return false;
    }

    /**
     * Close any open dialogs/dropdowns
     */
    async function closeDialogs() {
        document.body.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'Escape',
            keyCode: 27,
            bubbles: true,
            cancelable: true,
            composed: true
        }));
        await sleep(300);
    }

    /**
     * Select option from dropdown by text
     */
    async function selectDropdownOption(dropdownSelector, optionText, dropdownIndex = 0) {
        console.log(`[VEO-AUTO] Selecting "${optionText}" from dropdown ${dropdownIndex}`);

        // Find dropdown buttons
        const dropdowns = document.querySelectorAll(dropdownSelector);
        if (dropdownIndex >= dropdowns.length) {
            console.log(`[VEO-AUTO] Dropdown index ${dropdownIndex} not found (${dropdowns.length} available)`);
            return false;
        }

        const dropdown = dropdowns[dropdownIndex];
        if (!isFullyVisible(dropdown)) {
            console.log('[VEO-AUTO] Dropdown not visible');
            return false;
        }

        // Click to open dropdown
        await clickElement(dropdown);
        await sleep(500);

        // Find and click option
        const options = document.querySelectorAll('[role="option"]');
        for (const opt of options) {
            const text = opt.textContent.trim();
            if (text === optionText || text.includes(optionText)) {
                await clickElement(opt);
                await sleep(300);
                console.log(`[VEO-AUTO] Selected: ${text}`);
                return true;
            }
        }

        console.log(`[VEO-AUTO] Option "${optionText}" not found`);
        await closeDialogs();
        return false;
    }

    /**
     * Configure generation settings
     */
    async function configureSettings(options) {
        // [Existing configureSettings logic preserved if needed, but robust version below is preferred]
        return configureSettingsRobust(options);
    }

    /**
     * Select option using a specific dropdown element (Helper for Robust method)
     */
    async function selectDropdownOptionWithElement(dropdownElement, optionText) {
        if (!isFullyVisible(dropdownElement)) {
            console.log('[VEO-AUTO] Dropdown not visible');
            return false;
        }

        await clickElement(dropdownElement);
        await sleep(500);

        const options = document.querySelectorAll('[role="option"]');
        let bestMatch = null;

        // 1. Exact Match
        for (const opt of options) {
            if (opt.textContent.trim() === optionText) {
                bestMatch = opt;
                break;
            }
        }

        // 2. Starts With Match
        if (!bestMatch) {
            for (const opt of options) {
                if (opt.textContent.trim().startsWith(optionText)) {
                    bestMatch = opt;
                    break;
                }
            }
        }

        // 3. Contains Match
        if (!bestMatch) {
            for (const opt of options) {
                if (opt.textContent.trim().includes(optionText)) {
                    bestMatch = opt;
                    break;
                }
            }
        }

        if (bestMatch) {
            await clickElement(bestMatch);
            await sleep(300);
            console.log(`[VEO-AUTO] Selected: ${bestMatch.textContent.trim()}`);
            return true;
        }

        console.log(`[VEO-AUTO] Option "${optionText}" not found`);
        await closeDialogs();
        return false;
    }

    // ============= Prompt Submission =============
    /**
    * Find the prompt textarea
    */
    function findPromptTextarea() {
        let textarea = document.querySelector(CONFIG.SELECTORS.PROMPT_TEXTAREA);
        if (textarea && isFullyVisible(textarea)) return textarea;

        const textareas = document.querySelectorAll('textarea');
        for (const ta of textareas) {
            if (isFullyVisible(ta)) return ta;
        }
        return null;
    }

    function findSubmitButton() {
        let btn = findButtonByIcon('arrow_forward');
        if (btn && isFullyVisible(btn)) return btn;

        btn = findButtonByIcon('send');
        if (btn && isFullyVisible(btn)) return btn;

        btn = document.querySelector('button.gdArnN');
        if (btn && isFullyVisible(btn)) return btn;

        const buttons = document.querySelectorAll('button');
        for (const b of buttons) {
            const text = b.textContent.toLowerCase().trim();
            if (text === 'generate' || text === 'create' || text === 'submit') {
                if (isFullyVisible(b)) return b;
            }
        }
        return null;
    }

    async function typeText(element, text, humanLike = false) {
        console.log(`[VEO-AUTO] Setting text (${text.length} chars, humanLike=${humanLike})...`);
        element.focus();
        element.click();
        await sleep(100);

        element.select();
        document.execCommand('delete');
        await sleep(50);

        if (humanLike) {
            for (let i = 0; i < text.length; i++) {
                document.execCommand('insertText', false, text[i]);
                await sleep(CONFIG.TYPE_DELAY + Math.random() * 20);
            }
        } else {
            document.execCommand('insertText', false, text);
        }

        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));

        await sleep(100);
        console.log('[VEO-AUTO] Text set complete');
    }

    async function submitPrompt(prompt, humanLike = false) {
        console.log(`[VEO-AUTO] Submitting prompt: ${prompt.substring(0, 50)}...`);
        const textarea = findPromptTextarea();
        if (!textarea) return { success: false, error: 'Textarea not found' };

        await typeText(textarea, prompt, humanLike);
        await sleep(500);

        const submitBtn = findSubmitButton();
        if (!submitBtn) return { success: false, error: 'Submit button not found' };

        await clickElement(submitBtn);
        console.log('[VEO-AUTO] Prompt submitted');
        return { success: true };
    }

    // ============= Image Upload =============
    function base64ToFile(base64Data, fileName, mimeType = 'image/png') {
        const base64 = base64Data.replace(/^data:[^;]+;base64,/, '');
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: mimeType });
        return new File([blob], fileName, { type: mimeType });
    }

    function findAddImageButton() {
        let btn = findButtonByIcon('add');
        if (btn && isFullyVisible(btn)) return btn;
        btn = findButtonByIcon('add_photo_alternate');
        if (btn && isFullyVisible(btn)) return btn;

        const presentationDiv = document.querySelector('div[role="presentation"]');
        if (presentationDiv) {
            const buttons = presentationDiv.querySelectorAll('button');
            for (const b of buttons) { if (isFullyVisible(b)) return b; }
        }
        return null;
    }

    async function uploadImage(base64Data, fileName = 'image.png', aspectRatio = null) {
        console.log(`[VEO-AUTO] Uploading image: ${fileName}`);
        const addBtn = findAddImageButton();
        if (!addBtn) return { success: false, error: 'Add image button not found' };

        await clickElement(addBtn);
        await sleep(500);

        const fileInput = document.querySelector('input[type="file"]');
        if (!fileInput) return { success: false, error: 'File input not found' };

        const file = base64ToFile(base64Data, fileName);
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        fileInput.files = dataTransfer.files;
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));

        console.log('[VEO-AUTO] File input triggered');
        await sleep(1000);
        await sleep(2000); // Wait for crop

        if (aspectRatio) {
            const ratioText = CONFIG.ASPECT_RATIOS[aspectRatio] || aspectRatio;
            const ratioButtons = document.querySelectorAll('button');
            for (const btn of ratioButtons) {
                if (btn.textContent.includes(ratioText)) {
                    await clickElement(btn);
                    await sleep(300);
                    break;
                }
            }
        }

        const confirmBtn = findButtonByIcon('check') || findButtonByIcon('done');
        if (confirmBtn && isFullyVisible(confirmBtn)) {
            await clickElement(confirmBtn);
            await sleep(500);
        }

        console.log('[VEO-AUTO] Image uploaded');
        return { success: true };
    }

    // ============= Progress Monitoring =============
    function getProgress() {
        const allText = document.body.innerText;
        const percentMatch = allText.match(/(\d+)%/);
        if (percentMatch) return { status: 'generating', progress: parseInt(percentMatch[1]) };

        const icons = document.querySelectorAll('i');
        for (const icon of icons) {
            if (icon.textContent && icon.textContent.includes('progress_activity')) return { status: 'generating', progress: 0 };
        }

        // Check for completed video elements that are visible and have src
        const videos = document.querySelectorAll('video');
        for (const video of videos) {
            if (video.src && isFullyVisible(video)) return { status: 'complete', progress: 100 };
        }

        return { status: 'idle', progress: 0 };
    }

    async function waitForGeneration(timeout = CONFIG.GENERATION_TIMEOUT) {
        console.log('[VEO-AUTO] Waiting for generation...');
        const startTime = Date.now();
        let lastProgress = 0;

        while (Date.now() - startTime < timeout) {
            const status = getProgress();
            if (status.progress !== lastProgress) {
                console.log(`[VEO-AUTO] Progress: ${status.progress}%`);
                lastProgress = status.progress;
            }
            if (status.status === 'complete') {
                console.log('[VEO-AUTO] Generation complete');
                return { success: true, status: 'complete' };
            }

            const bodyText = document.body.innerText;
            if (bodyText.match(/queue.?full/i)) return { success: false, status: 'queue_full' };
            if (bodyText.match(/policy.?error/i)) return { success: false, status: 'policy_error' };

            await sleep(2000);
        }
        return { success: false, status: 'timeout' };
    }

    // ============= Resource Extraction & Download =============
    function getCompletedResources() {
        const resources = [];
        const videos = document.querySelectorAll('video');
        for (const video of videos) {
            if (video.src && isFullyVisible(video)) {
                resources.push({ type: 'video', url: video.src, element: video });
            }
        }
        return resources;
    }

    async function downloadResource(quality = 'original', promptText = '', scopeElement = null) {
        // [Simplified downloadResource for manual/fallback use]
        console.log(`[VEO-AUTO] Download Resource (Legacy) invoked.`);
        // Note: New scanAndDownload API handles main flow. 
        // Calls simple download from view logic or new API.
        // For compatibility, we return success if needed.
        return { success: true, message: 'Delegated to API' };
    }

    // ============= Background Download Scanner (API) =============

    /**
     * Reports current operation status (downloads happen via fetch interception)
     */
    async function scanAndDownload(options = {}) {
        // Downloads now happen automatically via fetch interception
        // This function just reports current state for the Python controller

        const activeCount = window.veoState.activeOperations.size;
        const processedCount = window.veoState.processedOperations.size;

        console.log(`[VEO-AUTO] Status: ${activeCount} active, ${processedCount} processed`);

        // Check for errors in page
        const bodyText = document.body.innerText;
        let errorStatus = null;
        if (bodyText.match(/queue.?full/i)) errorStatus = 'queue_full';
        if (bodyText.match(/policy.?error/i)) errorStatus = 'policy_error';

        // --- Enhanced: Detect Failed Generation cards ---
        // Look for cards showing "Failed Generation" or similar error states
        const failedPrompts = [];

        // Try multiple selectors for failed generation cards
        const possibleFailedCards = [];

        // Method 1: Look for cards with "Failed Generation" text
        document.querySelectorAll('[class*="card"], [class*="item"], [class*="prompt"], [class*="generation"]').forEach(card => {
            const cardText = card.innerText || '';
            if (cardText.includes('Failed Generation') ||
                cardText.includes('generation_failed') ||
                cardText.includes('Failed to generate') ||
                cardText.match(/failed/i)) {
                possibleFailedCards.push(card);
            }
        });

        // Method 2: Look for error icons/badges
        document.querySelectorAll('.error, .failed, [class*="error"], [class*="failed"]').forEach(errorEl => {
            const parent = errorEl.closest('[class*="card"], [class*="item"], [class*="prompt"]');
            if (parent && !possibleFailedCards.includes(parent)) {
                possibleFailedCards.push(parent);
            }
        });

        // Method 3: Look for specific VEO failure indicators (red status, X icon)
        document.querySelectorAll('.material-icons, .material-icons-outlined').forEach(icon => {
            const iconText = icon.textContent.trim();
            if (iconText === 'error' || iconText === 'cancel' || iconText === 'close') {
                const parent = icon.closest('[class*="card"], [class*="item"], [class*="prompt"]');
                if (parent && !possibleFailedCards.includes(parent)) {
                    const parentText = parent.innerText || '';
                    // Only include if it looks like a generation item
                    if (parentText.length > 10 && !parentText.includes('Generating')) {
                        possibleFailedCards.push(parent);
                    }
                }
            }
        });

        // Extract prompt text from detected failed cards
        for (const card of possibleFailedCards) {
            const cardText = card.innerText.trim();
            // Try to extract the prompt text (usually the main content)
            let promptText = '';
            let reason = 'Failed Generation';

            // Look for prompt text in the card
            const textElements = card.querySelectorAll('p, span, div');
            for (const el of textElements) {
                const text = el.textContent.trim();
                // Skip common labels
                if (text &&
                    text.length > 20 &&
                    !text.includes('Failed') &&
                    !text.includes('Error') &&
                    !text.includes('Retry') &&
                    !text.includes('Generate')) {
                    promptText = text.slice(0, 100); // Limit to 100 chars for matching
                    break;
                }
            }

            // Determine reason
            if (cardText.includes('Policy') || cardText.includes('policy')) {
                reason = 'Policy violation';
            } else if (cardText.includes('timeout') || cardText.includes('Timeout')) {
                reason = 'Generation timeout';
            } else if (cardText.includes('capacity') || cardText.includes('Capacity')) {
                reason = 'Server capacity issue';
            }

            if (promptText) {
                failedPrompts.push({
                    prompt: promptText,
                    reason: reason
                });
                console.log(`[VEO-AUTO] Detected failed generation: "${promptText.slice(0, 40)}..." - ${reason}`);
            }
        }

        // Get pending downloads
        // CRITICAL FIX: Only return and remove the matching download if requested
        // This prevents one worker from clearing the queue for other workers
        const originalPending = window.veoState.pendingDownloads || [];
        const returnedDownloads = [];

        if (options.targetPromptPrefix) {
            // Targeted retrieval mode
            const prefix = options.targetPromptPrefix.toLowerCase();

            // [NEW] UI Fallback: Scan DOM for this specific prompt
            // This handles cases where API interception missed the ID/completion
            try {
                const foundInUI = [];
                // Find all text nodes/elements containing the prefix
                // Using TreeWalker for efficiency or just selecting common containers
                const candidates = document.querySelectorAll('p, span, div[role="textbox"], .line-clamp-3');

                for (const el of candidates) {
                    if (isFullyVisible(el) && el.textContent.toLowerCase().includes(prefix)) {
                        // Found text match, look for associated video
                        const card = el.closest('div[class*="Cell"], li, div[class*="item"]');
                        if (card) {
                            const video = card.querySelector('video');
                            if (video && video.src && video.src.startsWith('http')) {
                                // Found a completed video for this prompt!
                                const url = video.src;
                                // Deduplicate: check if already in processed or active
                                const alreadyKnown = Array.from(window.veoState.processedOperations).some(op => op === url) ||
                                    window.veoState.pendingDownloads.some(p => p.url === url);

                                if (!alreadyKnown) {
                                    console.log(`[VEO-AUTO] UI Fallback: Found completed video for "${prefix}"`);
                                    const safeName = prefix.replace(/[^a-z0-9]/gi, '_').substring(0, 60) + "_fallback.mp4";

                                    // Add to originalPending so it gets picked up below
                                    originalPending.push({
                                        url: url,
                                        prompt: el.textContent.substring(0, 100),
                                        filename: safeName,
                                        isFallback: true
                                    });
                                }
                            }
                        }
                    }
                }
            } catch (e) {
                console.log("[VEO-AUTO] UI Scan Error:", e);
            }

            const remaining = [];

            for (const item of originalPending) {
                const itemPrompt = (item.prompt || '').toLowerCase();
                // Check for overlapping match (first 20 chars)
                if (prefix.length >= 10 && (itemPrompt.includes(prefix.substring(0, 20)) || prefix.includes(itemPrompt.substring(0, 20)))) {
                    returnedDownloads.push(item); // Add to return list
                } else {
                    remaining.push(item); // Keep in queue
                }
            }

            // Update the state with ONLY the non-matched items
            window.veoState.pendingDownloads = remaining;

        } else {
            // Legacy mode: Return all and clear (potential data loss with multiple workers)
            // But we'll default to copying checking
            returnedDownloads.push(...originalPending);
            window.veoState.pendingDownloads = []; // Clear all
        }

        return {
            newDownloads: [],
            pendingDownloadUrls: returnedDownloads, // URLs for Python-based download
            failedPrompts: failedPrompts,
            error: errorStatus,
            activeOperations: activeCount,
            processedOperations: processedCount
        };
    }

    // ============= Main Task Execution =============

    async function runTask(payload) {
        console.log('[VEO-AUTO] Running task:', payload);

        // [NEW] Check for "Create with Flow" button (Landing Page)
        try {
            // Try specific selector first, then generic fallback
            const flowBtn = document.querySelector("#hero button") ||
                document.evaluate('//*[@id="hero"]/div[1]/div[2]/button', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;

            if (flowBtn && isFullyVisible(flowBtn)) {
                console.log("[VEO-AUTO] Found 'Create with Flow' button, clicking...");
                await clickElement(flowBtn);
                await sleep(3000); // Wait for navigation
            }
        } catch (e) {
            console.log("[VEO-AUTO] Navigation check error:", e);
        }

        const {
            mode = 'textToVideo',
            prompt,
            images = [],
            aspectRatio = 'landscape',
            outputCount = 1,
            model = null,
            skipSettings = false
        } = payload;

        try {
            if (!skipSettings) {
                await configureSettingsRobust({ mode, aspectRatio, outputCount, model });
            } else {
                console.log('[VEO-AUTO] Skipping settings configuration');
            }

            if (images && images.length > 0) {
                for (const img of images) {
                    const result = await uploadImage(img.base64, img.name, aspectRatio);
                    if (!result.success) return { success: false, error: result.error, step: 'upload' };
                }
            }

            if (prompt) {
                // Record timestamp BEFORE submission to attribute errors correctly
                const submissionStartTime = Date.now();

                const submitResult = await submitPrompt(prompt, payload.humanLike || false);
                if (!submitResult.success) return { success: false, error: submitResult.error, step: 'submit' };

                // Check for immediate submission errors (403s, queue full, etc.)
                console.log('[VEO-AUTO] Checking for submission errors...');

                // Poll for errors - check multiple times to catch delayed 403s
                // IMPORTANT: Only attribute errors that occurred AFTER this submission
                for (let i = 0; i < 5; i++) {
                    await sleep(1000); // Check every 1 second, total 5 checks

                    if (window.veoState.lastSubmissionError) {
                        const err = window.veoState.lastSubmissionError;

                        // Only attribute this error to current task if it happened AFTER our submission
                        if (err.time >= submissionStartTime) {
                            console.log(`[VEO-AUTO] ✗ Detected submission failure: ${err.status} (check ${i + 1}, error time=${err.time}, submit time=${submissionStartTime})`);
                            window.veoState.lastSubmissionError = null; // Clear for next attempt
                            return { success: false, error: `submission_failed_${err.status}`, step: 'submission' };
                        } else {
                            console.log(`[VEO-AUTO] Ignoring stale error from previous task (error time=${err.time} < submit time=${submissionStartTime})`);
                            // Clear stale error so it doesn't confuse future checks
                            window.veoState.lastSubmissionError = null;
                        }
                    }

                    // Check for queue full in page
                    const bodyText = document.body.innerText;
                    if (bodyText.match(/queue.?full/i)) {
                        return { success: false, error: 'queue_full', step: 'submission' };
                    }
                }

                console.log('[VEO-AUTO] No submission errors detected after 5s.');

                // Sequential mode (default): Wait for generation to complete, then download
                const waitForCompletion = payload.waitForCompletion !== false; // Default: true

                if (waitForCompletion) {
                    console.log('[VEO-AUTO] Sequential mode: Waiting for video generation to complete...');

                    // Wait for the video to generate (up to 5 minutes)
                    const genResult = await waitForGeneration(CONFIG.GENERATION_TIMEOUT);

                    if (genResult.success && genResult.status === 'complete') {
                        console.log('[VEO-AUTO] ✓ Video generation complete! Triggering download...');

                        // Small delay to ensure UI has fully updated
                        await sleep(2000);

                        // Trigger download scan to capture the completed video
                        const promptPrefix = prompt.substring(0, 40).toLowerCase();
                        const downloadResult = await scanAndDownload({
                            targetPromptPrefix: promptPrefix,
                            downloadQuality: payload.downloadQuality || 'original'
                        });

                        const downloadCount = (downloadResult.pendingDownloadUrls || []).length;
                        console.log(`[VEO-AUTO] ✓ Sequential task complete. Downloads found: ${downloadCount}`);

                        return {
                            success: true,
                            status: 'completed',
                            downloads: downloadResult.pendingDownloadUrls || [],
                            downloadCount: downloadCount
                        };
                    } else {
                        // Generation failed or timed out
                        const errorReason = genResult.status || 'unknown_error';
                        console.log(`[VEO-AUTO] ✗ Generation failed: ${errorReason}`);
                        return {
                            success: false,
                            error: `generation_${errorReason}`,
                            step: 'generation'
                        };
                    }
                } else {
                    // Legacy fire-and-forget mode
                    console.log('[VEO-AUTO] Fire-and-Forget mode: Prompt submitted, returning immediately.');
                    return { success: true, status: 'submitted_async' };
                }
            }

            // No prompt case - just settings/images
            return { success: true, status: 'completed' };

        } catch (error) {
            console.error('[VEO-AUTO] Task error:', error);
            return { success: false, error: error.message, step: 'unknown' };
        }
    }

    // ============= Heavy Click & Robust Settings (Helper for configureSettingsRobust) =============
    async function dispatchHeavyClick(element) {
        if (!element) return;
        const events = ['pointerover', 'mouseover', 'pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'];
        for (const eventType of events) {
            const event = new MouseEvent(eventType, { bubbles: true, cancelable: true, composed: true, view: window, detail: 1, buttons: eventType.includes('down') ? 1 : 0 });
            element.dispatchEvent(event);
        }
        await sleep(300);
    }

    async function clickElementRobust(element, description = 'element') {
        if (!element) return false;
        if (!isFullyVisible(element)) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await sleep(500);
        }
        await dispatchHeavyClick(element);
        return true;
    }

    async function configureSettingsRobust(options) {
        const { mode, aspectRatio, outputCount, model } = options;
        console.log('[VEO-AUTO] Configuring Robust Settings:', options);

        // Track results for debugging
        const results = {
            success: true,
            tuneButtonFound: false,
            dialogFound: false,
            dropdownCount: 0,
            aspectRatioSet: false,
            outputCountSet: false,
            modelTriggerFound: false,
            modelSelected: false,
            logs: []
        };

        const dropdownSelector = 'button[role="combobox"][aria-autocomplete="none"]';

        // Helper: Get all visible dropdowns not in dialogs
        const getMainBarDropdowns = () => {
            const all = document.querySelectorAll(dropdownSelector);
            return Array.from(all).filter(el => isFullyVisible(el) && !el.closest('div[role="dialog"]'));
        };

        // Helper: Select option by text with retry
        const selectOptionByText = async (targetText, dropdownElement = null) => {
            let options = [];
            for (let attempt = 0; attempt < 10; attempt++) {
                await sleep(200);
                options = document.querySelectorAll('[role="option"]');
                if (options.length > 0) break;
                if (attempt === 5 && dropdownElement) {
                    await clickElementRobust(dropdownElement, 'Dropdown (retry)');
                }
            }

            if (options.length === 0) return false;

            const targetLower = targetText.toLowerCase().replace(/\s+/g, '');

            // Exact match
            for (const opt of options) {
                if (opt.textContent.trim() === targetText) {
                    await clickElementRobust(opt, `Option "${targetText}"`);
                    return true;
                }
            }
            // Contains match
            for (const opt of options) {
                const optLower = opt.textContent.trim().toLowerCase().replace(/\s+/g, '');
                if (optLower.includes(targetLower) || targetLower.includes(optLower)) {
                    await clickElementRobust(opt, `Option "${opt.textContent.trim()}"`);
                    return true;
                }
            }

            console.log(`[VEO-AUTO] Option "${targetText}" not found`);
            await closeDialogs();
            return false;
        };

        // Step 1: Open Settings Dialog (tune button)
        console.log('[VEO-AUTO] Opening settings dialog...');
        let settingsButton = null;
        const allButtons = document.querySelectorAll('button');
        for (const btn of allButtons) {
            const icon = btn.querySelector('i');
            if (icon && icon.textContent && icon.textContent.includes('tune')) {
                settingsButton = btn;
                break;
            }
        }

        if (settingsButton) {
            results.tuneButtonFound = true;
            results.logs.push('Tune button found, clicking...');
            await clickElementRobust(settingsButton, 'Tune Button');
            await sleep(700);
        } else {
            results.logs.push('Tune button NOT found, trying openSettings fallback');
            await openSettings();
            await sleep(700);
        }

        // Step 2: Find dropdowns inside dialog
        const dialog = document.querySelector('div[role="dialog"]');
        results.dialogFound = !!dialog;
        results.logs.push(`Dialog found: ${!!dialog}`);
        const getDialogDropdowns = () => {
            if (dialog) {
                return Array.from(dialog.querySelectorAll(dropdownSelector));
            }
            return getMainBarDropdowns();
        };

        let dialogDropdowns = getDialogDropdowns();
        results.dropdownCount = dialogDropdowns.length;
        results.logs.push(`Dropdowns in dialog: ${dialogDropdowns.length}`);
        console.log(`[VEO-AUTO] Found ${dialogDropdowns.length} dropdowns in dialog`);

        // Step 3: Configure Aspect Ratio (Index 0 in dialog)
        if (aspectRatio && dialogDropdowns.length >= 1) {
            const ratioText = CONFIG.ASPECT_RATIOS[aspectRatio] || aspectRatio;
            console.log(`[VEO-AUTO] Setting Aspect Ratio to: ${ratioText}`);
            const ratioDropdown = dialogDropdowns[0];
            if (ratioDropdown) {
                await clickElementRobust(ratioDropdown, 'Aspect Ratio Dropdown');
                await sleep(500);
                const arResult = await selectOptionByText(ratioText, ratioDropdown);
                results.aspectRatioSet = arResult;
                results.logs.push(`Aspect ratio '${ratioText}': ${arResult ? 'SET' : 'FAILED'}`);
            }
        } else {
            results.logs.push(`Aspect ratio skipped (ratio=${aspectRatio}, dropdowns=${dialogDropdowns.length})`);
        }

        await sleep(300);
        dialogDropdowns = getDialogDropdowns();

        // Step 4: Configure Output Count (Index 1 in dialog) - ALWAYS SET TO 1
        console.log('[VEO-AUTO] Setting Output Count to 1');
        if (dialogDropdowns.length >= 2) {
            const countDropdown = dialogDropdowns[1];
            if (countDropdown) {
                await clickElementRobust(countDropdown, 'Output Count Dropdown');
                await sleep(500);
                const countOptions = document.querySelectorAll('[role="option"]');
                let matched = false;
                // Strict exact match on '1' only
                for (const opt of countOptions) {
                    const optText = opt.textContent.trim();
                    if (optText === '1') {
                        await clickElementRobust(opt, 'Output Count 1');
                        matched = true;
                        console.log('[VEO-AUTO] ✓ Output count set to 1 (exact match)');
                        break;
                    }
                }
                // Fallback: find option that starts with '1' but is just '1'
                if (!matched) {
                    for (const opt of countOptions) {
                        const optText = opt.textContent.trim();
                        if (optText === '1' || optText.match(/^1\s/)) {
                            await clickElementRobust(opt, 'Output Count 1 (fallback)');
                            matched = true;
                            console.log('[VEO-AUTO] ✓ Output count set to 1 (fallback match)');
                            break;
                        }
                    }
                }
                if (!matched) {
                    console.log('[VEO-AUTO] ⚠ Could not find output count option "1", closing dropdown');
                    results.logs.push('Output count: FAILED, no matching option');
                    await closeDialogs();
                } else {
                    results.outputCountSet = true;
                    results.logs.push('Output count: SET to 1');
                }
            }
        } else {
            results.logs.push(`Output count: SKIPPED (only ${dialogDropdowns.length} dropdowns, need 2)`);
            console.log('[VEO-AUTO] ⚠ Output count dropdown not found (only ' + dialogDropdowns.length + ' dropdowns)');
        }

        await sleep(300);
        dialogDropdowns = getDialogDropdowns();

        // Step 5: Configure Model — it's INSIDE the settings dialog, labeled "Model"
        // It's a separate dropdown section (not a combobox) showing radio button options
        // Options: "Veo 3.1 - Fast", "Veo 3.1 - Fast [Lower Priority]", "Veo 3.1 - Quality", etc.
        if (model) {
            console.log(`[VEO-AUTO] Setting Model to: "${model}"`);

            // The model selector is inside the settings dialog
            // It's a dropdown/button showing text like "Veo 3.1 - Fast [Lower Priority]"
            const currentDialog = document.querySelector('div[role="dialog"]');

            if (currentDialog) {
                // Strategy 1: Find a button/trigger inside dialog containing "Veo" or model text
                let modelTrigger = null;
                const dialogClickables = currentDialog.querySelectorAll('button, [role="combobox"], [role="listbox"], [data-state], [aria-haspopup]');

                for (const el of dialogClickables) {
                    const text = el.textContent.toLowerCase().trim();
                    if (text.includes('veo') || text.includes('imagen') || text.includes('lower priority') || text.includes('fast') || text.includes('quality')) {
                        modelTrigger = el;
                        console.log(`[VEO-AUTO] Found model trigger in dialog (S1): "${el.textContent.trim().substring(0, 60)}"`);
                        break;
                    }
                }

                // Strategy 2: Look for element after "Model" label
                if (!modelTrigger) {
                    const allElements = currentDialog.querySelectorAll('*');
                    let foundModelLabel = false;
                    for (const el of allElements) {
                        if (el.children.length === 0 && el.textContent.trim() === 'Model') {
                            foundModelLabel = true;
                            continue;
                        }
                        if (foundModelLabel) {
                            const tag = el.tagName.toLowerCase();
                            if (tag === 'button' || tag === 'select' || el.getAttribute('role') || el.getAttribute('data-state') !== null || el.getAttribute('aria-haspopup')) {
                                modelTrigger = el;
                                console.log(`[VEO-AUTO] Found model trigger after label (S2): "${el.textContent.trim().substring(0, 60)}"`);
                                break;
                            }
                        }
                    }
                }

                if (modelTrigger) {
                    results.modelTriggerFound = true;
                    const triggerText = modelTrigger.textContent.trim().substring(0, 60);
                    results.logs.push(`Model trigger found: "${triggerText}"`);

                    // Check if already showing the correct model
                    if (triggerText.toLowerCase().includes('lower priority')) {
                        results.modelSelected = true;
                        results.logs.push(`Model already set to Lower Priority, skipping`);
                        console.log(`[VEO-AUTO] ✓ Model already set to: "${triggerText}"`);
                    } else {
                        console.log(`[VEO-AUTO] Clicking model dropdown: "${triggerText}"`);

                        // Record existing popover-like elements before clicking
                        const existingPopovers = new Set(
                            Array.from(document.querySelectorAll('[data-radix-popper-content-wrapper], [data-side], [role="listbox"], [role="radiogroup"], [role="menu"]'))
                        );

                        await clickElementRobust(modelTrigger, 'Model Dropdown Trigger');
                        await sleep(800);

                        // === FIND THE NEWLY-APPEARED POPOVER ===
                        // Strategy A: Find Radix popover containers that appeared after clicking
                        let popoverContainer = null;
                        const popoverSelectors = [
                            '[data-radix-popper-content-wrapper]',
                            '[data-side]',
                            '[role="listbox"]',
                            '[role="radiogroup"]',
                            '[role="menu"]'
                        ];

                        for (const sel of popoverSelectors) {
                            const candidates = document.querySelectorAll(sel);
                            for (const c of candidates) {
                                if (!existingPopovers.has(c)) {
                                    popoverContainer = c;
                                    console.log(`[VEO-AUTO] Found new popover via "${sel}"`);
                                    break;
                                }
                            }
                            if (popoverContainer) break;
                        }

                        // Strategy B: Any popover/overlay that appeared (check last children of body)
                        if (!popoverContainer) {
                            const bodyChildren = document.body.children;
                            for (let i = bodyChildren.length - 1; i >= Math.max(0, bodyChildren.length - 5); i--) {
                                const child = bodyChildren[i];
                                if (child.querySelector('[role="radio"], [role="menuitemradio"], [role="option"], [data-state]')) {
                                    popoverContainer = child;
                                    console.log(`[VEO-AUTO] Found popover as body child #${i}`);
                                    break;
                                }
                            }
                        }

                        // === SEARCH FOR MODEL OPTIONS ===
                        let modelOptionCandidates = [];

                        if (popoverContainer) {
                            // Search within the popover only
                            console.log(`[VEO-AUTO] Searching within popover (${popoverContainer.tagName}, children: ${popoverContainer.children.length})`);
                            results.logs.push(`Popover found: ${popoverContainer.tagName}`);

                            const popoverEls = popoverContainer.querySelectorAll('*');
                            for (const el of popoverEls) {
                                const text = el.textContent.trim();
                                if (text.length === 0 || text.length > 120) continue;
                                // Look for elements that contain model-related text
                                const hasModelText = textLower.includes('veo') || textLower.includes('imagen') || textLower.includes('priority') ||
                                    textLower.includes('fast') || textLower.includes('quality');
                                if (!hasModelText) continue;

                                const tag = el.tagName.toLowerCase();
                                const isClickable = tag === 'button' || tag === 'label' ||
                                    el.getAttribute('role') === 'radio' ||
                                    el.getAttribute('role') === 'menuitemradio' ||
                                    el.getAttribute('role') === 'option' ||
                                    el.getAttribute('data-state') !== null ||
                                    el.hasAttribute('data-value');
                                const isLeafLike = el.children.length <= 5;

                                if ((isClickable || isLeafLike) && hasModelText) {
                                    modelOptionCandidates.push(el);
                                }
                            }
                        } else {
                            // Fallback: search globally but EXCLUDE the dialog and sidebar
                            console.log('[VEO-AUTO] No popover found, searching globally (excluding dialog/sidebar)');
                            results.logs.push('No popover found, global search');

                            const allEls = document.querySelectorAll('*');
                            for (const el of allEls) {
                                // Skip elements inside the dialog or sidebar nav
                                if (el.closest('div[role="dialog"]')) continue;
                                if (el.closest('nav')) continue;
                                if (el.closest('[role="navigation"]')) continue;

                                const text = el.textContent.trim();
                                if (text.length === 0 || text.length > 120) continue;
                                const textLower = text.toLowerCase();
                                if (!textLower.includes('veo') && !textLower.includes('priority')) continue;
                                // Must have a dash (model names like "Veo 3.1 - Fast")
                                if (!text.includes('-') && !textLower.includes('priority')) continue;

                                const tag = el.tagName.toLowerCase();
                                const isClickable = tag === 'button' || tag === 'label' ||
                                    el.getAttribute('role') === 'radio' ||
                                    el.getAttribute('role') === 'menuitemradio' ||
                                    el.getAttribute('role') === 'option' ||
                                    el.getAttribute('data-state') !== null;
                                const isTextContainer = (tag === 'div' || tag === 'span') && el.children.length <= 5;

                                if (isClickable || isTextContainer) {
                                    modelOptionCandidates.push(el);
                                }
                            }
                        }

                        // Deduplicate and log
                        const optionTexts = modelOptionCandidates.map(o => o.textContent.trim().substring(0, 80));
                        console.log(`[VEO-AUTO] Model options found (${optionTexts.length}): ${JSON.stringify(optionTexts)}`);
                        results.logs.push(`Model options (${optionTexts.length}): ${JSON.stringify(optionTexts)}`);

                        // Find "Lower Priority" option
                        let bestMatch = null;
                        let bestMatchLen = Infinity;

                        for (const opt of modelOptionCandidates) {
                            const optText = opt.textContent.trim();
                            if (optText.toLowerCase().includes('lower priority')) {
                                if (optText.length < bestMatchLen) {
                                    bestMatch = opt;
                                    bestMatchLen = optText.length;
                                }
                            }
                        }

                        if (bestMatch) {
                            const optText = bestMatch.textContent.trim();
                            console.log(`[VEO-AUTO] Clicking model option: "${optText}"`);
                            await clickElementRobust(bestMatch, `Model Option "${optText.substring(0, 40)}"`);
                            results.modelSelected = true;
                            results.logs.push(`Model selected: "${optText}"`);
                            console.log(`[VEO-AUTO] ✓ Model selected: "${optText}"`);
                        } else {
                            results.logs.push(`Model FAILED: 'Lower Priority' not found among: ${JSON.stringify(optionTexts)}`);
                            console.log(`[VEO-AUTO] ⚠ Could not find "Lower Priority" among: ${JSON.stringify(optionTexts)}`);
                        }

                        // Close the model dropdown popover with Escape
                        document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true, cancelable: true, composed: true }));
                        await sleep(300);
                    }
                } else {
                    // Debug: log all elements in dialog
                    const debugEls = currentDialog.querySelectorAll('button, select, [role]');
                    const debugTexts = Array.from(debugEls).map(e => `[${e.tagName} role=${e.getAttribute('role')}] "${e.textContent.trim().substring(0, 40)}"`);
                    results.logs.push(`Model trigger NOT found in dialog. Elements: ${debugTexts.join(' | ')}`);
                    console.log(`[VEO-AUTO] ⚠ No model trigger found in dialog. Elements: ${debugTexts.join(' | ')}`);
                }
            } else {
                results.logs.push('Settings dialog not found for model selection');
                console.log('[VEO-AUTO] ⚠ Settings dialog not found for model selection');
            }
        }

        // Step 6: Close Settings Dialog using Escape key (most reliable method)
        console.log('[VEO-AUTO] Closing settings dialog with Escape key...');
        document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true, cancelable: true, composed: true }));
        await sleep(500);
        // Verify dialog is closed, if not try again
        const remainingDialog = document.querySelector('div[role="dialog"]');
        if (remainingDialog) {
            console.log('[VEO-AUTO] Dialog still open, pressing Escape again...');
            document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true, cancelable: true, composed: true }));
            await sleep(300);
        }

        console.log('[VEO-AUTO] ✓ Settings configuration complete, results:', JSON.stringify(results));
        return results;
    }

    /**
     * Check for landing page and click "Create with Flow"
     */
    async function checkAndHandleLandingPage() {
        console.log('[VEO-AUTO] Checking for landing page...');
        try {
            // Try specific selector first, then generic fallback
            const flowBtn = document.querySelector("#hero button") ||
                document.evaluate('//*[@id="hero"]/div[1]/div[2]/button', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;

            if (flowBtn && isFullyVisible(flowBtn)) {
                console.log("[VEO-AUTO] Found 'Create with Flow' button, clicking...");
                await clickElement(flowBtn);
                await sleep(3000); // Wait for navigation
                return { handled: true };
            }
        } catch (e) {
            console.log("[VEO-AUTO] Navigation check error:", e);
        }
        return { handled: false };
    }

    /**
     * Check if the page is ready (document loaded + textarea present)
     */
    function checkPageReady() {
        const readyState = document.readyState;
        const hasTextarea = !!document.querySelector('textarea, div[contenteditable="true"]');
        return {
            ready: readyState === 'complete' && hasTextarea,
            readyState: readyState,
            hasTextarea: hasTextarea
        };
    }

    // ============= Exposed API =============
    window.VeoFlowAutomation = {
        checkAndHandleLandingPage,
        checkPageReady,
        configureSettings,
        configureSettingsRobust,
        submitPrompt,
        uploadImage,
        scanAndDownload,
        runTask,
        waitForGeneration,
        clickElement,
        sleep
    };

    console.log('[VEO-AUTO] API ready: window.VeoFlowAutomation');

})();
