const DEFAULT_CATEGORIES = ['Tech', 'Agri', 'Others'];
const UNCATEGORIZED = 'Uncategorized';

document.addEventListener('DOMContentLoaded', () => {
  loadSavedVideos();

  document.getElementById('searchInput').addEventListener('input', loadSavedVideos);
  document.getElementById('searchField').addEventListener('change', loadSavedVideos);
  document.getElementById('categoryFilter').addEventListener('change', loadSavedVideos);
  document.getElementById('statusFilter').addEventListener('change', loadSavedVideos);
  document.getElementById('categoryForm').addEventListener('submit', addCategory);

  document.getElementById('saveBtn').addEventListener('click', async () => {
    const saveButton = document.getElementById('saveBtn');
    const category = document.getElementById('categorySelect').value;
    if (!category) {
      alert("Please select a category before saving!");
      return;
    }

    saveButton.disabled = true;
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      let videoUrl;
      try {
        videoUrl = new URL(tab?.url);
      } catch {
        alert("Please open a YouTube watch page to save a video!");
        return;
      }

      if (
        (videoUrl.hostname !== 'youtube.com' && !videoUrl.hostname.endsWith('.youtube.com'))
        || videoUrl.pathname !== '/watch'
      ) {
        alert("Please open a YouTube watch page to save a video!");
        return;
      }

      const [injection] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: extractYoutubeMetadata
      });
      const metadata = injection?.result;
      if (!metadata?.title) {
        throw new Error('Could not read video metadata from this YouTube page.');
      }

      const videoData = {
        title: metadata.title,
        url: tab.url,
        category,
        thumbnail: metadata.thumbnail || '',
        channel: metadata.channel || '',
        duration: metadata.duration || 0,
        watched: false
      };
      const result = await chrome.storage.local.get({ watchLater: [] });
      await chrome.storage.local.set({ watchLater: [videoData, ...result.watchLater] });
      loadSavedVideos();
    } catch (error) {
      alert(error.message || 'Could not save this video. Please try again.');
    } finally {
      saveButton.disabled = false;
    }
  });
});

function extractYoutubeMetadata() {
  const details = window.ytInitialPlayerResponse?.videoDetails;
  const getMetaContent = (selector) => document.querySelector(selector)?.content || '';
  const title = details?.title
    || getMetaContent('meta[property="og:title"]')
    || document.title.replace(/ - YouTube$/, '');
  const thumbnails = details?.thumbnail?.thumbnails || [];
  const bestThumbnail = thumbnails.reduce((best, candidate) => (
    !best || candidate.width > best.width ? candidate : best
  ), null);
  const thumbnail = bestThumbnail
    ? bestThumbnail.url
    : getMetaContent('meta[property="og:image"]');
  const channel = details?.author
    || getMetaContent('meta[name="author"]')
    || document.querySelector('#owner #channel-name a, ytd-video-owner-renderer #channel-name a')?.textContent.trim()
    || '';
  const videoDuration = document.querySelector('video')?.duration;
  const duration = Number(details?.lengthSeconds)
    || (Number.isFinite(videoDuration) && videoDuration > 0 ? Math.floor(videoDuration) : 0);

  return { title: title.trim(), thumbnail, channel, duration };
}

function loadSavedVideos() {
  const listContainer = document.getElementById('videoList');
  const searchQuery = document.getElementById('searchInput').value.trim().toLocaleLowerCase();
  const searchField = document.getElementById('searchField').value;
  const statusFilter = document.getElementById('statusFilter').value;

  chrome.storage.local.get({ watchLater: [], categories: DEFAULT_CATEGORIES }, (result) => {
    const savedVideos = result.watchLater;
    const categories = normalizeCategories(result.categories);
    renderCategoryControls(categories);
    const categoryFilter = document.getElementById('categoryFilter').value;
    const videos = savedVideos
      .map((video, index) => ({ video, index }))
      .filter(({ video }) => categoryFilter === 'all'
        || (categoryFilter === UNCATEGORIZED
          ? !video.category || video.category === UNCATEGORIZED
          : video.category === categoryFilter))
      .filter(({ video }) => matchesStatusFilter(video, statusFilter))
      .filter(({ video }) => matchesVideoSearch(video, searchQuery, searchField));

    if (videos.length === 0) {
      const hasFilters = searchQuery.length > 0
        || statusFilter !== 'all'
        || categoryFilter !== 'all';
      const message = hasFilters
        ? 'No videos match these filters.'
        : 'No saved videos yet.';
      const emptyMessage = document.createElement('div');
      emptyMessage.className = 'empty';
      emptyMessage.textContent = message;
      listContainer.replaceChildren(emptyMessage);
      return;
    }

    listContainer.innerHTML = '';
    videos.forEach(({ video, index }) => {
      const item = document.createElement('div');
      item.className = 'video-item';

      if (video.thumbnail) {
        const thumbnail = document.createElement('img');
        thumbnail.className = 'video-thumbnail';
        thumbnail.src = video.thumbnail;
        thumbnail.alt = '';
        thumbnail.loading = 'lazy';
        item.appendChild(thumbnail);
      }

      const details = document.createElement('div');
      details.className = 'video-details';
      const link = document.createElement('a');
      link.href = video.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = video.title;
      details.appendChild(link);
      if (video.channel) {
        const channel = document.createElement('div');
        channel.className = 'video-metadata';
        channel.textContent = video.channel;
        details.appendChild(channel);
      }
      if (video.duration) {
        const duration = document.createElement('div');
        duration.className = 'video-metadata';
        duration.textContent = formatDuration(video.duration);
        details.appendChild(duration);
      }
      if (video.category) {
        const category = document.createElement('div');
        category.className = 'category';
        category.textContent = video.category;
        details.appendChild(category);
      }

      const status = document.createElement('div');
      status.className = video.watched ? 'video-status watched' : 'video-status';
      status.textContent = video.watched ? 'Watched' : 'Unwatched';
      details.appendChild(status);

      const statusButton = document.createElement('button');
      statusButton.className = 'status-toggle';
      statusButton.type = 'button';
      statusButton.textContent = video.watched ? 'Mark unwatched' : 'Mark watched';
      statusButton.setAttribute('aria-label', `${statusButton.textContent}: ${video.title}`);
      statusButton.addEventListener('click', () => setVideoWatched(index, !video.watched));
      details.appendChild(statusButton);

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

function normalizeCategories(categories) {
  return [...new Set(
    (Array.isArray(categories) ? categories : [])
      .filter((category) => typeof category === 'string')
      .map((category) => category.trim())
      .filter((category) => category && category.toLocaleLowerCase() !== UNCATEGORIZED.toLocaleLowerCase())
  )];
}

function renderCategoryControls(categories) {
  const categorySelect = document.getElementById('categorySelect');
  const categoryList = document.getElementById('categoryList');
  const categoryFilter = document.getElementById('categoryFilter');

  categorySelect.replaceChildren(new Option('Select a category', '', true, true));
  categorySelect.options[0].disabled = true;
  [...categories, UNCATEGORIZED].forEach((category) => {
    categorySelect.add(new Option(category, category));
  });

  categoryList.replaceChildren();
  categories.forEach((category) => {
    const chip = document.createElement('div');
    chip.className = 'category-chip';
    const label = document.createElement('span');
    label.textContent = category;
    const removeButton = document.createElement('button');
    removeButton.className = 'remove-category-btn';
    removeButton.type = 'button';
    removeButton.textContent = '×';
    removeButton.setAttribute('aria-label', `Delete category ${category}`);
    removeButton.addEventListener('click', () => deleteCategory(category));
    chip.append(label, removeButton);
    categoryList.appendChild(chip);
  });

  const selectedFilter = categoryFilter.value;
  categoryFilter.replaceChildren(new Option('All categories', 'all'));
  [...categories, UNCATEGORIZED].forEach((category) => {
    categoryFilter.add(new Option(category, category));
  });
  categoryFilter.value = ['all', ...categories, UNCATEGORIZED].includes(selectedFilter)
    ? selectedFilter
    : 'all';
}

function addCategory(event) {
  event.preventDefault();
  const input = document.getElementById('categoryName');
  const category = input.value.trim();
  if (!category) return;

  chrome.storage.local.get({ categories: DEFAULT_CATEGORIES }, (result) => {
    const categories = normalizeCategories(result.categories);
    if (
      category.toLocaleLowerCase() === UNCATEGORIZED.toLocaleLowerCase()
      || categories.some((existing) => existing.toLocaleLowerCase() === category.toLocaleLowerCase())
    ) {
      alert('That category already exists or is reserved.');
      return;
    }

    chrome.storage.local.set({ categories: [...categories, category] }, () => {
      input.value = '';
      loadSavedVideos();
    });
  });
}

function deleteCategory(category) {
  chrome.storage.local.get({ categories: DEFAULT_CATEGORIES, watchLater: [] }, (result) => {
    const categories = normalizeCategories(result.categories)
      .filter((existing) => existing !== category);
    const videos = result.watchLater.map((video) => (
      video.category === category ? { ...video, category: UNCATEGORIZED } : video
    ));

    chrome.storage.local.set({ categories, watchLater: videos }, () => {
      loadSavedVideos();
    });
  });
}

function matchesStatusFilter(video, statusFilter) {
  if (statusFilter === 'watched') return video.watched === true;
  if (statusFilter === 'unwatched') return video.watched !== true;
  return true;
}

function matchesVideoSearch(video, query, field) {
  if (!query) return true;

  const searchableValues = {
    title: video.title || '',
    channel: video.channel || '',
    tag: video.category || UNCATEGORIZED,
    duration: `${formatDuration(video.duration)} ${video.duration || ''}`
  };
  const values = field === 'all'
    ? Object.values(searchableValues)
    : [searchableValues[field] || ''];

  return values.some((value) => String(value).toLocaleLowerCase().includes(query));
}

function setVideoWatched(index, watched) {
  chrome.storage.local.get({ watchLater: [] }, (result) => {
    const videos = result.watchLater;
    if (index < 0 || index >= videos.length) return;

    videos[index].watched = watched;
    chrome.storage.local.set({ watchLater: videos }, loadSavedVideos);
  });
}

function formatDuration(seconds) {
  const totalSeconds = Number(seconds);
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return '';

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;
  return hours
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
    : `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
}

function deleteSavedVideo(index) {
  chrome.storage.local.get({ watchLater: [] }, (result) => {
    const videos = result.watchLater;
    if (index < 0 || index >= videos.length) return;

    videos.splice(index, 1);
    chrome.storage.local.set({ watchLater: videos }, loadSavedVideos);
  });
}