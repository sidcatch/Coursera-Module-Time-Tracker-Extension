// Coursera Module Time Tracker Content Script

class CourseraTimeTracker {
    constructor() {
        this.courseSlug = '';
        this.currentModule = '';
        this.storageKey = '';
        this.init();
    }

    init() {
        this.extractCourseInfo();
        if (this.currentModule) {
            this.waitForPageLoad();
        }
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
        // Simple timeout approach - wait for page to stabilize
        setTimeout(() => {
            this.extractAndSaveModuleTime();
            this.updateSidebar();
        }, 2000);

        // Also try after mutations settle
        const observer = new MutationObserver(() => {
            clearTimeout(this.timeoutId);
            this.timeoutId = setTimeout(() => {
                this.extractAndSaveModuleTime();
                this.updateSidebar();
            }, 1000);
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
        });

        // Clean up observer after 10 seconds
        setTimeout(() => observer.disconnect(), 10000);
    }

    extractAndSaveModuleTime() {
        // Get the CURRENT module from URL at time of extraction
        const currentUrl = window.location.href;
        const moduleMatch = currentUrl.match(/\/home\/module\/(\d+)/);

        if (!moduleMatch) {
            console.log('Coursera Time Tracker: Not on a module page');
            return;
        }

        const actualCurrentModule = moduleMatch[1];

        try {
            // Look for the time indicators
            const timeElements = document.querySelectorAll(
                '.css-md7uya .css-vyoujf',
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

            console.log(
                `Coursera Time Tracker: Found times for module ${actualCurrentModule}:`,
                { videoTime, readingTime },
            );

            if (videoTime || readingTime) {
                // Save data for the ACTUAL current module, not the initially detected one
                this.saveModuleTime(actualCurrentModule, {
                    videoTime,
                    readingTime,
                });
            } else {
                console.log(
                    'Coursera Time Tracker: No time data found on page',
                );
            }
        } catch (error) {
            console.log('Coursera Time Tracker: Error extracting time', error);
        }
    }

    async saveModuleTime(moduleNumber, timeData) {
        try {
            const result = await chrome.storage.local.get(this.storageKey);
            const courseData = result[this.storageKey] || {};

            courseData[`module_${moduleNumber}`] = {
                ...timeData,
                lastUpdated: Date.now(),
            };

            await chrome.storage.local.set({ [this.storageKey]: courseData });
            console.log(
                `Coursera Time Tracker: Saved data for module ${moduleNumber}:`,
                timeData,
            );
        } catch (error) {
            console.log('Coursera Time Tracker: Error saving data', error);
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
            'nav[aria-label="Course"] a[data-testid="rc-WeekNavigationItem"]',
        );

        moduleLinks.forEach((link) => {
            const moduleText = link.querySelector('.css-xkyeje');
            if (!moduleText) return;

            const moduleMatch = moduleText.textContent.match(/Module (\d+)/);
            if (!moduleMatch) return;

            const moduleNumber = moduleMatch[1];
            const moduleData = courseData[`module_${moduleNumber}`];

            if (
                moduleData &&
                (moduleData.videoTime || moduleData.readingTime)
            ) {
                // Remove existing time display if any
                const existingTimeDisplay = link.querySelector(
                    '.coursera-time-tracker',
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
        `;

                const timeInfo = [];
                if (moduleData.videoTime) {
                    timeInfo.push(`📹 ${moduleData.videoTime}`);
                }
                if (moduleData.readingTime) {
                    timeInfo.push(`📖 ${moduleData.readingTime}`);
                }

                timeDisplay.textContent = timeInfo.join(' • ');

                // Append to the module link
                const moduleContainer =
                    link.querySelector('.css-xkyeje').parentElement;
                if (moduleContainer) {
                    moduleContainer.appendChild(timeDisplay);
                }
            }
        });
    }

    updateCourseTotalTime(courseData) {
        // Find the "Course Material" section
        const courseMaterialHeader = document.querySelector(
            'nav[aria-label="Course"] .css-6ecy9b',
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
                    '.coursera-total-time',
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
