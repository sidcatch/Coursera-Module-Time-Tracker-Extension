# Coursera Module Time Tracker

A Chrome extension that displays remaining video and reading time for Coursera modules directly in the sidebar navigation, so you don't have to visit each module to check the time requirements.

## Features

-   📹 **Video Time Tracking**: Shows remaining video time for each module
-   📖 **Reading Time Tracking**: Shows remaining reading time for each module
-   📊 **Total Course Time**: Displays total time for all tracked modules in the Course Material section
-   💾 **Local Storage**: Saves time data locally for quick access
-   🔄 **Auto-Update**: Updates data when you visit modules
-   🎯 **Cross-Course Support**: Works with any Coursera course

## Installation

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the extension folder
5. The extension icon will appear in your Chrome toolbar

## Usage

1. **Visit a Coursera Module**: Navigate to any Coursera course module page like:

    ```
    https://www.coursera.org/learn/[course-name]/home/module/[number]
    ```

2. **Automatic Data Extraction**: The extension will automatically:

    - Extract remaining video and reading time from the module page
    - Store this information in local storage
    - Display the time next to the module in the sidebar

3. **View Time Information**:

    - Individual module times appear next to each Module in the sidebar
    - Total course time appears next to "Course Material" in the sidebar
    - Format: 📹 1h 20m • 📖 4h 15m

4. **Manage Data**: Click the extension icon to:
    - View stored time data for the current course
    - Refresh data by reloading the page
    - Clear all stored data if needed

## How It Works

### Data Extraction

The extension looks for time indicators in the module overview section:

-   Searches for elements containing "videos left" and "readings left"
-   Extracts time formats like "1h 20m", "30m", "2h"
-   Stores data per course using the course slug from the URL

### Sidebar Integration

-   Finds module navigation links in the sidebar
-   Adds time information below each module name
-   Calculates and displays total time for Course Material section
-   Updates display when navigating between modules

### Storage Format

Data is stored in Chrome's local storage using the format:

```javascript
{
  "coursera_[course-slug]": {
    "module_1": {
      "videoTime": "6 min",
      "readingTime": "15 min",
      "lastUpdated": 1234567890
    },
    "module_2": { ... }
  }
}
```

## File Structure

```
coursera-time-tracker/
├── manifest.json          # Extension configuration
├── content.js             # Main content script
├── popup.html             # Extension popup interface
├── popup.js               # Popup functionality
├── icons/                 # Extension icons (16x16, 48x48, 128x128)
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md              # This file
```

## Browser Compatibility

-   Chrome (Manifest V3)
-   Edge (Chromium-based)
-   Other Chromium-based browsers

## Privacy

-   All data is stored locally in your browser
-   No data is sent to external servers
-   Only activates on Coursera.org domains
-   Requires minimal permissions (storage, activeTab)

## Troubleshooting

### Time Not Appearing

1. Make sure you're on a Coursera module page
2. Check if the page has fully loaded
3. Try refreshing the page
4. Open the extension popup to check stored data

### Data Not Saving

1. Check if the extension has storage permissions
2. Try clearing all data and revisiting modules
3. Ensure you're on the correct URL format

### Sidebar Not Updating

1. The extension needs the sidebar navigation to be visible
2. Try expanding the Course Material section
3. Navigate to different modules to trigger updates

## Contributing

Feel free to submit issues or pull requests to improve the extension.

## License

MIT License - feel free to modify and distribute as needed.
