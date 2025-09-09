// Popup script for Coursera Time Tracker

class PopupManager {
    constructor() {
        this.currentCourse = null;
        this.init();
    }

    async init() {
        await this.checkCurrentTab();
        await this.loadCourseData();
        this.setupEventListeners();
    }

    async checkCurrentTab() {
        try {
            const [tab] = await chrome.tabs.query({
                active: true,
                currentWindow: true,
            });
            const url = tab.url;

            const courseMatch = url.match(/coursera\.org\/learn\/([^\/]+)/);
            const moduleMatch = url.match(/\/home\/module\/(\d+)/);

            if (courseMatch && moduleMatch) {
                this.currentCourse = courseMatch[1];
                this.updateStatus(
                    'active',
                    `Active on ${this.currentCourse.replace(/-/g, ' ')}`,
                );
            } else if (courseMatch) {
                this.currentCourse = courseMatch[1];
                this.updateStatus(
                    'active',
                    `Coursera course detected: ${this.currentCourse.replace(
                        /-/g,
                        ' ',
                    )}`,
                );
            } else {
                this.updateStatus('inactive', 'Not on a Coursera course page');
            }
        } catch (error) {
            this.updateStatus('inactive', 'Unable to access current tab');
        }
    }

    updateStatus(type, message) {
        const statusEl = document.getElementById('status');
        const statusTextEl = document.getElementById('statusText');

        statusEl.className = `status ${type}`;
        statusTextEl.textContent = message;
    }

    async loadCourseData() {
        if (!this.currentCourse) {
            document.getElementById('emptyState').style.display = 'block';
            return;
        }

        try {
            const storageKey = `coursera_${this.currentCourse}`;
            const result = await chrome.storage.local.get(storageKey);
            const courseData = result[storageKey];

            if (courseData && Object.keys(courseData).length > 0) {
                this.displayCourseData(courseData);
            } else {
                document.getElementById('emptyState').style.display = 'block';
            }
        } catch (error) {
            console.error('Error loading course data:', error);
            document.getElementById('emptyState').style.display = 'block';
        }
    }

    displayCourseData(courseData) {
        const courseInfoEl = document.getElementById('courseInfo');
        const courseNameEl = document.getElementById('courseName');
        const moduleListEl = document.getElementById('moduleList');

        courseNameEl.textContent = this.currentCourse
            .replace(/-/g, ' ')
            .replace(/\b\w/g, (l) => l.toUpperCase());

        // Clear existing content
        moduleListEl.innerHTML = '';

        // Sort modules alphabetically by name
        const sortedModules = Object.entries(courseData)
            .filter(
                ([key, data]) => data && (data.videoTime || data.readingTime),
            )
            .sort(([a, dataA], [b, dataB]) => {
                const nameA = dataA.moduleName || a;
                const nameB = dataB.moduleName || b;
                return nameA.localeCompare(nameB);
            });

        if (sortedModules.length === 0) {
            moduleListEl.innerHTML =
                '<div class="empty-state">No module data found</div>';
        } else {
            sortedModules.forEach(([moduleKey, moduleData]) => {
                const moduleItem = this.createModuleItem(
                    moduleData.moduleName || moduleKey,
                    moduleData,
                );
                moduleListEl.appendChild(moduleItem);
            });
        }

        courseInfoEl.style.display = 'block';
    }

    createModuleItem(moduleName, moduleData) {
        const item = document.createElement('div');
        item.className = 'module-item';

        const nameEl = document.createElement('div');
        nameEl.className = 'module-name';
        nameEl.textContent = moduleName;

        const timeEl = document.createElement('div');
        timeEl.className = 'module-time';

        const timeInfo = [];
        if (moduleData.videoTime) {
            timeInfo.push(`📹 ${moduleData.videoTime}`);
        }
        if (moduleData.readingTime) {
            timeInfo.push(`📖 ${moduleData.readingTime}`);
        }

        timeEl.textContent =
            timeInfo.length > 0 ? timeInfo.join(' • ') : 'No time data';

        item.appendChild(nameEl);
        item.appendChild(timeEl);

        return item;
    }

    setupEventListeners() {
        document.getElementById('refreshBtn').addEventListener('click', () => {
            this.refreshData();
        });

        document.getElementById('clearBtn').addEventListener('click', () => {
            this.clearAllData();
        });
    }

    async refreshData() {
        // Reload the content script on the current tab
        try {
            const [tab] = await chrome.tabs.query({
                active: true,
                currentWindow: true,
            });
            await chrome.tabs.reload(tab.id);
            window.close();
        } catch (error) {
            console.error('Error refreshing data:', error);
        }
    }

    async clearAllData() {
        if (!confirm('Are you sure you want to clear all stored time data?')) {
            return;
        }

        try {
            // Get all storage keys
            const allData = await chrome.storage.local.get(null);
            const courseraKeys = Object.keys(allData).filter((key) =>
                key.startsWith('coursera_'),
            );

            // Remove all coursera data
            if (courseraKeys.length > 0) {
                await chrome.storage.local.remove(courseraKeys);
            }

            // Refresh the popup
            await this.loadCourseData();

            // Show feedback
            this.updateStatus('active', 'All data cleared successfully');

            setTimeout(() => {
                this.checkCurrentTab();
            }, 2000);
        } catch (error) {
            console.error('Error clearing data:', error);
            this.updateStatus('inactive', 'Error clearing data');
        }
    }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new PopupManager();
});
