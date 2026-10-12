let selectedCategoryTab = 'All';

document.addEventListener('DOMContentLoaded', () => {
  loadSavedVideos();

  document.querySelectorAll('.category-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      selectedCategoryTab = tab.dataset.category;
      document.querySelectorAll('.category-tab').forEach((categoryTab) => {
        categoryTab.setAttribute('aria-selected', categoryTab === tab ? 'true' : 'false');
      });
      loadSavedVideos();
    });
  });

  document.getElementById('saveBtn').addEventListener('click', async () => {
    const category = document.getElementById('categorySelect').value;
    if (!category) {
      alert("Please select a category before saving!");
      return;
    }

    // Query the active tab in the browser window
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || !tab.url || !tab.url.includes("youtube.com/watch")) {
      alert("Please open a YouTube watch page to save a video!");
      return;
    }

    const videoData = {
      title: tab.title.replace(" - YouTube", ""), // Clean up YouTube title suffix
      url: tab.url,
      category
    };

    // Fetch existing saved list, append new video, and save back
    chrome.storage.local.get({ watchLater: [] }, (result) => {
      const updatedList = [videoData, ...result.watchLater];
      
      chrome.storage.local.set({ watchLater: updatedList }, () => {
        loadSavedVideos();
      });
    });
  });
});

function loadSavedVideos() {
  const listContainer = document.getElementById('videoList');
  
  chrome.storage.local.get({ watchLater: [] }, (result) => {
    const videos = result.watchLater
      .map((video, index) => ({ video, index }))
      .filter(({ video }) => selectedCategoryTab === 'All' || video.category === selectedCategoryTab);

    if (videos.length === 0) {
      const message = selectedCategoryTab === 'All'
        ? 'No saved videos yet.'
        : `No ${escapeHtml(selectedCategoryTab)} videos yet.`;
      listContainer.innerHTML = `<div class="empty">${message}</div>`;
      return;
    }

    listContainer.innerHTML = '';
    videos.forEach(({ video, index }) => {
      const item = document.createElement('div');
      item.className = 'video-item';

      const details = document.createElement('div');
      details.className = 'video-details';
      details.innerHTML = `<a href="${escapeHtml(video.url)}" target="_blank">${escapeHtml(video.title)}</a>`;
      if (video.category) {
        const category = document.createElement('div');
        category.className = 'category';
        category.textContent = video.category;
        details.appendChild(category);
      }

      const deleteButton = document.createElement('button');
      deleteButton.className = 'delete-btn';
      deleteButton.type = 'button';
      deleteButton.textContent = 'X';
      deleteButton.setAttribute('aria-label', `Delete ${video.title}`);
      deleteButton.addEventListener('click', () => deleteSavedVideo(index));

      item.append(details, deleteButton);
      listContainer.appendChild(item);
    });
  });
}

function deleteSavedVideo(index) {
  chrome.storage.local.get({ watchLater: [] }, (result) => {
    const videos = result.watchLater;
    if (index < 0 || index >= videos.length) return;

    videos.splice(index, 1);
    chrome.storage.local.set({ watchLater: videos }, loadSavedVideos);
  });
}

// Basic helper to prevent HTML injection from video titles
function escapeHtml(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(text).replace(/[&<>"']/g, (m) => map[m]);
}