const COURSERA_TRACKER_CONFIG = {
    // Set to true to store data only once per module (never update)
    // Set to false to always update data when visiting modules
    STORE_ONCE_ONLY: true,

    // Other configurable options
    EXTRACTION_DELAY: 2000,
    MUTATION_DELAY: 1000,
    DEBUG_LOGGING: true,

    // CSS Selectors
    SELECTORS: {
        // Module navigation
        CURRENT_MODULE_LINK:
            'nav[aria-label="Course"] a[data-testid="rc-WeekNavigationItem"].css-1bzswin',
        CURRENT_MODULE_FALLBACK:
            'nav[aria-label="Course"] a[data-testid="rc-WeekNavigationItem"][aria-label*="currently have this selected"]',
        MODULE_TEXT: '.css-xkyeje',
        ALL_MODULE_LINKS:
            'nav[aria-label="Course"] a[data-testid="rc-WeekNavigationItem"]',

        // Time extraction
        TIME_ELEMENTS: '.css-md7uya .css-vyoujf',

        // Course material section
        COURSE_MATERIAL_HEADER: 'nav[aria-label="Course"] .css-6ecy9b',

        // Page header fallback
        PAGE_HEADER: 'h1, h2, [class*="module"], [class*="Module"]',

        // Extension classes
        TIME_TRACKER_CLASS: '.coursera-time-tracker',
        TOTAL_TIME_CLASS: '.coursera-total-time',
    },
};

class CourseraTimeTracker {
    constructor() {
        this.courseSlug = '';
        this.currentModule = '';
        this.storageKey = '';
        this.isExtracting = false; // ADD THIS
        this.lastSavedModule = null; // ADD THIS
        this.timeoutId = null; // ADD THIS
        this.init();
    }

    init() {
        this.extractCourseInfo();
        if (this.currentModule) {
            this.waitForPageLoad();
        }
    }

    createModuleKey(moduleName) {
        // Convert module name to a safe storage key
        return moduleName
            .toLowerCase()
            .replace(/[^a-zA-Z0-9]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '');
    }

    getCurrentModuleName() {
        // Find the currently selected module in the sidebar
        const currentModuleLink = document.querySelector(
            COURSERA_TRACKER_CONFIG.SELECTORS.CURRENT_MODULE_LINK,
        );

        if (currentModuleLink) {
            const moduleText = currentModuleLink.querySelector(
                COURSERA_TRACKER_CONFIG.SELECTORS.MODULE_TEXT,
            );
            if (moduleText) {
                return moduleText.textContent.trim();
            }
        }

        // Fallback: try to find any selected module link with different class patterns
        const fallbackModuleLink = document.querySelector(
            COURSERA_TRACKER_CONFIG.SELECTORS.CURRENT_MODULE_FALLBACK,
        );

        if (fallbackModuleLink) {
            const moduleText = fallbackModuleLink.querySelector(
                COURSERA_TRACKER_CONFIG.SELECTORS.MODULE_TEXT,
            );
            if (moduleText) {
                return moduleText.textContent.trim();
            }
        }

        // Last fallback: try to extract from page content
        const pageHeader = document.querySelector(
            COURSERA_TRACKER_CONFIG.SELECTORS.PAGE_HEADER,
        );
        if (pageHeader && pageHeader.textContent.includes('Module')) {
            return pageHeader.textContent.trim();
        }

        return null;
    }

    extractCourseInfo() {
        const url = window.location.href;
        const match = url.match(/\/learn\/([^\/]+)\/home\/module\/(\d+)/);

        if (match) {
            this.courseSlug = match[1];
            this.currentModule = match[2];
            this.storageKey = `coursera_${this.courseSlug}`;
            console.log(
                `Coursera Time Tracker: Detected course ${this.courseSlug}, module ${this.currentModule}`,
            );
        }
    }

    waitForPageLoad() {
        // Clear any existing timeout
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
        }

        // Simple timeout approach - wait for page to stabilize
        this.timeoutId = setTimeout(() => {
            if (!this.isExtracting) {
                this.extractAndSaveModuleTime();
            }
            this.updateSidebar();
        }, COURSERA_TRACKER_CONFIG.EXTRACTION_DELAY);

        // Also try after mutations settle
        const observer = new MutationObserver(() => {
            if (this.timeoutId) {
                clearTimeout(this.timeoutId);
            }
            this.timeoutId = setTimeout(() => {
                if (!this.isExtracting) {
                    this.extractAndSaveModuleTime();
                }
                this.updateSidebar();
            }, COURSERA_TRACKER_CONFIG.MUTATION_DELAY);
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
        });

        // Clean up observer after 10 seconds
        setTimeout(() => observer.disconnect(), 10000);
    }

    extractAndSaveModuleTime() {
        // Prevent multiple simultaneous extractions
        if (this.isExtracting) {
            return;
        }

        this.isExtracting = true;

        // Get the CURRENT module from URL at time of extraction
        const currentUrl = window.location.href;
        const moduleMatch = currentUrl.match(/\/home\/module\/(\d+)/);

        if (!moduleMatch) {
            if (COURSERA_TRACKER_CONFIG.DEBUG_LOGGING) {
                console.log('Coursera Time Tracker: Not on a module page');
            }
            this.isExtracting = false;
            return;
        }

        const actualCurrentModule = moduleMatch[1];
        const currentModuleName = this.getCurrentModuleName();

        if (!currentModuleName) {
            if (COURSERA_TRACKER_CONFIG.DEBUG_LOGGING) {
                console.log(
                    'Coursera Time Tracker: Could not determine current module name',
                );
            }
            this.isExtracting = false;
            return;
        }

        const moduleKey = this.createModuleKey(currentModuleName);

        // CHECK IF DATA ALREADY EXISTS - only if STORE_ONCE_ONLY is enabled
        if (COURSERA_TRACKER_CONFIG.STORE_ONCE_ONLY) {
            this.checkExistingData(moduleKey).then((dataExists) => {
                if (dataExists) {
                    if (COURSERA_TRACKER_CONFIG.DEBUG_LOGGING) {
                        console.log(
                            `Coursera Time Tracker: Data already exists for ${currentModuleName}, skipping extraction`,
                        );
                    }
                    this.isExtracting = false;
                    return;
                }
                this.performExtraction(actualCurrentModule);
            });
        } else {
            // Always extract and potentially update data
            this.performExtraction(actualCurrentModule);
        }
    }

    async checkExistingData(moduleKey) {
        try {
            const result = await chrome.storage.local.get(this.storageKey);
            const courseData = result[this.storageKey] || {};
            const moduleData = courseData[moduleKey];

            // Return true if data exists and has either video or reading time
            const dataExists =
                moduleData && (moduleData.videoTime || moduleData.readingTime);

            if (COURSERA_TRACKER_CONFIG.DEBUG_LOGGING && dataExists) {
                console.log(
                    `Coursera Time Tracker: Found existing data for ${moduleKey}:`,
                    moduleData,
                );
            }

            return dataExists;
        } catch (error) {
            if (COURSERA_TRACKER_CONFIG.DEBUG_LOGGING) {
                console.log(
                    'Coursera Time Tracker: Error checking existing data',
                    error,
                );
            }
            return false;
        }
    }

    performExtraction(actualCurrentModule) {
        try {
            const currentModuleName = this.getCurrentModuleName();
            if (!currentModuleName) {
                if (COURSERA_TRACKER_CONFIG.DEBUG_LOGGING) {
                    console.log(
                        'Coursera Time Tracker: Could not determine current module name',
                    );
                }
                this.isExtracting = false;
                return;
            }

            const moduleKey = this.createModuleKey(currentModuleName);

            // Look for the time indicators
            const timeElements = document.querySelectorAll(
                COURSERA_TRACKER_CONFIG.SELECTORS.TIME_ELEMENTS,
            );

            let videoTime = '';
            let readingTime = '';

            timeElements.forEach((element) => {
                const text = element.textContent.trim();
                if (text.includes('videos left')) {
                    videoTime =
                        text.match(/\b\d+h\s*\d+m|\b\d+\s*min|\b\d+h/)?.[0] ||
                        '';
                } else if (text.includes('readings left')) {
                    readingTime =
                        text.match(/\b\d+h\s*\d+m|\b\d+\s*min|\b\d+h/)?.[0] ||
                        '';
                }
            });

            if (videoTime || readingTime) {
                this.saveModuleTime(moduleKey, {
                    videoTime,
                    readingTime,
                    moduleName: currentModuleName,
                });
                this.lastSavedModule = moduleKey;
            } else {
                if (COURSERA_TRACKER_CONFIG.DEBUG_LOGGING) {
                    console.log(
                        'Coursera Time Tracker: No time data found on page',
                    );
                }
            }
        } catch (error) {
            if (COURSERA_TRACKER_CONFIG.DEBUG_LOGGING) {
                console.log(
                    'Coursera Time Tracker: Error extracting time',
                    error,
                );
            }
        } finally {
            this.isExtracting = false;
        }
    }

    async saveModuleTime(moduleKey, timeData) {
        try {
            const result = await chrome.storage.local.get(this.storageKey);
            const courseData = result[this.storageKey] || {};

            courseData[moduleKey] = {
                ...timeData,
                lastUpdated: Date.now(),
            };

            await chrome.storage.local.set({ [this.storageKey]: courseData });

            if (COURSERA_TRACKER_CONFIG.DEBUG_LOGGING) {
                console.log(
                    `Coursera Time Tracker: Saved data for ${moduleKey}:`,
                    timeData,
                );
            }
        } catch (error) {
            if (COURSERA_TRACKER_CONFIG.DEBUG_LOGGING) {
                console.log('Coursera Time Tracker: Error saving data', error);
            }
        }
    }

    async updateSidebar() {
        try {
            const result = await chrome.storage.local.get(this.storageKey);
            const courseData = result[this.storageKey] || {};

            // Update individual module times
            this.updateModuleTimes(courseData);

            // Update total course time
            this.updateCourseTotalTime(courseData);
        } catch (error) {
            console.log('Coursera Time Tracker: Error updating sidebar', error);
        }
    }

    updateModuleTimes(courseData) {
        // Find all module links in the sidebar
        const moduleLinks = document.querySelectorAll(
            COURSERA_TRACKER_CONFIG.SELECTORS.ALL_MODULE_LINKS,
        );

        moduleLinks.forEach((link) => {
            const moduleText = link.querySelector(
                COURSERA_TRACKER_CONFIG.SELECTORS.MODULE_TEXT,
            );
            if (!moduleText) return;

            const moduleName = moduleText.textContent.trim();
            const moduleKey = this.createModuleKey(moduleName);
            const moduleData = courseData[moduleKey];

            if (
                moduleData &&
                (moduleData.videoTime || moduleData.readingTime)
            ) {
                // Remove existing time display if any
                const existingTimeDisplay = link.querySelector(
                    COURSERA_TRACKER_CONFIG.SELECTORS.TIME_TRACKER_CLASS,
                );
                if (existingTimeDisplay) {
                    existingTimeDisplay.remove();
                }

                // Create time display
                const timeDisplay = document.createElement('div');
                timeDisplay.className = 'coursera-time-tracker';
                timeDisplay.style.cssText = `
  font-size: 11px;
  color: #666;
  margin-top: 2px;
  line-height: 1.2;
  position: absolute;
  top: 1.7rem;
  left: 4.7rem;
`;

                const timeInfo = [];
                if (moduleData.videoTime) {
                    timeInfo.push(`📹 ${moduleData.videoTime}`);
                }
                if (moduleData.readingTime) {
                    timeInfo.push(`📖 ${moduleData.readingTime}`);
                }

                timeDisplay.textContent = timeInfo.join(' • ');

                link.style.position = 'relative';
                link.appendChild(timeDisplay);
            }
        });
    }

    updateCourseTotalTime(courseData) {
        // Find the "Course Material" section
        const courseMaterialHeader = document.querySelector(
            COURSERA_TRACKER_CONFIG.SELECTORS.COURSE_MATERIAL_HEADER,
        );
        if (
            !courseMaterialHeader ||
            courseMaterialHeader.textContent !== 'Course Material'
        )
            return;

        // Calculate total times
        let totalVideoMinutes = 0;
        let totalReadingMinutes = 0;

        Object.values(courseData).forEach((moduleData) => {
            if (moduleData.videoTime) {
                totalVideoMinutes += this.parseTimeToMinutes(
                    moduleData.videoTime,
                );
            }
            if (moduleData.readingTime) {
                totalReadingMinutes += this.parseTimeToMinutes(
                    moduleData.readingTime,
                );
            }
        });

        if (totalVideoMinutes > 0 || totalReadingMinutes > 0) {
            // Remove existing total time display
            const existingTotal =
                courseMaterialHeader.parentElement.querySelector(
                    COURSERA_TRACKER_CONFIG.SELECTORS.TOTAL_TIME_CLASS,
                );
            if (existingTotal) {
                existingTotal.remove();
            }

            // Create total time display
            const totalDisplay = document.createElement('div');
            totalDisplay.className = 'coursera-total-time';
            totalDisplay.style.cssText = `
    font-size: 11px;
    color: #666;
    margin-top: 4px;
    line-height: 1.2;
    font-weight: normal;
  `;

            const totalInfo = [];
            if (totalVideoMinutes > 0) {
                totalInfo.push(
                    `📹 ${this.formatMinutesToTime(totalVideoMinutes)}`,
                );
            }
            if (totalReadingMinutes > 0) {
                totalInfo.push(
                    `📖 ${this.formatMinutesToTime(totalReadingMinutes)}`,
                );
            }

            totalDisplay.textContent = `Total: ${totalInfo.join(' • ')}`;

            // Insert after the Course Material header
            courseMaterialHeader.parentElement.appendChild(totalDisplay);
        }
    }

    parseTimeToMinutes(timeString) {
        let minutes = 0;

        // Handle formats like "1h 20m", "30m", "2h"
        const hourMatch = timeString.match(/(\d+)h/);
        const minuteMatch = timeString.match(/(\d+)m/);

        if (hourMatch) {
            minutes += parseInt(hourMatch[1]) * 60;
        }

        if (minuteMatch) {
            minutes += parseInt(minuteMatch[1]);
        }

        // Handle "30 min" format
        if (timeString.includes('min') && !minuteMatch) {
            const minMatch = timeString.match(/(\d+)\s*min/);
            if (minMatch) {
                minutes += parseInt(minMatch[1]);
            }
        }

        return minutes;
    }

    formatMinutesToTime(totalMinutes) {
        if (totalMinutes < 60) {
            return `${totalMinutes}m`;
        }

        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;

        if (minutes === 0) {
            return `${hours}h`;
        }

        return `${hours}h ${minutes}m`;
    }
}

// Initialize the tracker when the page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new CourseraTimeTracker();
    });
} else {
    new CourseraTimeTracker();
}

// Handle navigation changes (for single-page app behavior)
let lastUrl = location.href;
new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
        lastUrl = url;
        // Small delay to let the page update
        setTimeout(() => {
            new CourseraTimeTracker();
        }, 1000);
    }
}).observe(document, { subtree: true, childList: true });
