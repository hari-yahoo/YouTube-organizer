# YouTube Organizer

A lightweight Chrome extension for saving YouTube videos to a personal watch-later list. Videos are stored locally in Chrome and can be organized with categories, searched, filtered, and marked as watched.

## Features

- Save videos directly from a YouTube watch page.
- Automatically capture the video title, thumbnail, channel name, and duration.
- Organize videos with custom categories. The default categories are **Tech**, **Agri**, and **Others**.
- Delete categories; videos assigned to a deleted category are moved to **Uncategorized**.
- Search by title, channel, category tag, or duration.
- Filter by category and watched status.
- Pick a random video from all saved videos and open it in a new tab.
- Mark saved videos as watched or unwatched, and remove videos from the list.
- Keep saved videos and categories in Chrome local storage.

## Install in Chrome

1. Download or clone this repository.
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode**.
4. Select **Load unpacked** and choose the project folder containing `manifest.json`.
5. Pin **Custom YouTube Watch Later** from the Extensions menu for convenient access.

After changing the extension files, reload it from `chrome://extensions`.

## Use

### Save a video

1. Open a YouTube video watch page.
2. Open the extension popup.
3. Select a category and choose **Save video**.

The extension reads metadata from the open YouTube page. If a video is unavailable or YouTube does not expose its metadata, saving may fail or some metadata fields may be empty.

### Manage categories

Use **Manage categories** to add or delete categories. Category names are limited to 40 characters; names are compared without regard to letter case when checking for duplicates. **Uncategorized** is reserved for videos whose category has been deleted or is missing.

### Search and filter

Expand **Search and filters** to search saved videos by **All fields**, **Title**, **Channel**, **Tag**, or **Duration**, and narrow results by category or watched status. Searches and filters can be combined.

### Pick a video

Choose **Pick one for me** to open a randomly selected video from all saved videos in a new tab. The selection is not limited by the current search or filters.

### Update a saved video

Use **Mark watched** or **Mark unwatched** on a video to change its status. Use the **X** button to remove it from the list.

## Permissions and data

- `activeTab` and `scripting` are used to read metadata from the active YouTube watch page when saving.
- `storage` is used to save the video list and categories in Chrome local storage.
- The host permission is limited to `https://www.youtube.com/*`.

Saved data stays in this Chrome profile's local extension storage; it is not synced by this extension to an account or server.
