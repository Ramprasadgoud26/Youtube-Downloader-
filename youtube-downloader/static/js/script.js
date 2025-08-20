// Enhanced YouTube Downloader JavaScript
class YouTubeDownloader {
    constructor() {
        this.currentVideoId = null;
        this.selectedQuality = null;
        this.selectedType = null;
        this.currentVideoUrl = null;
        this.downloadInterval = null;
        this.notificationTimeout = null;
        
        this.initializeElements();
        this.bindEvents();
    }

    // Initialize DOM elements
    initializeElements() {
        this.elements = {
            searchBtn: document.getElementById('searchBtn'),
            fetchBtn: document.getElementById('fetchBtn'),
            searchQuery: document.getElementById('searchQuery'),
            videoUrl: document.getElementById('videoUrl'),
            searchResults: document.getElementById('searchResults'),
            videoGrid: document.getElementById('videoGrid'),
            resultsCount: document.getElementById('resultsCount'),
            clearResults: document.getElementById('clearResults'),
            videoPreview: document.getElementById('videoPreview'),
            videoThumbnail: document.getElementById('videoThumbnail'),
            videoTitle: document.getElementById('videoTitle'),
            videoDuration: document.getElementById('videoDuration'),
            videoViews: document.getElementById('videoViews'),
            videoAuthor: document.getElementById('videoAuthor'),
            downloadOptions: document.getElementById('downloadOptions'),
            progressBar: document.getElementById('progressBar'),
            progress: document.getElementById('progress'),
            progressText: document.getElementById('progressText'),
            tabBtns: document.querySelectorAll('.tab-btn'),
            tabContents: document.querySelectorAll('.tab-content')
        };
    }

    // Bind all event listeners
    bindEvents() {
        // Tab switching
        this.elements.tabBtns.forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e));
        });

        // Search functionality
        this.elements.searchBtn.addEventListener('click', () => this.searchVideos());
        this.elements.searchQuery.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.searchVideos();
        });

        // URL fetch functionality
        this.elements.fetchBtn.addEventListener('click', () => this.fetchVideoFromUrl());
        this.elements.videoUrl.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.fetchVideoFromUrl();
        });

        // URL validation
        this.elements.videoUrl.addEventListener('input', (e) => this.validateUrl(e));

        // Clear results
        this.elements.clearResults.addEventListener('click', () => this.clearAll());

        // Quality button selection
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('quality-btn')) {
                this.selectQuality(e.target);
            }
        });

        // Download buttons
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('download-btn') || e.target.closest('.download-btn')) {
                const btn = e.target.classList.contains('download-btn') ? e.target : e.target.closest('.download-btn');
                this.startDownload(btn);
            }
        });

        // Input placeholders
        this.setupInputPlaceholders();
    }

    // Tab switching functionality
    switchTab(e) {
        const tabId = e.target.dataset.tab;
        
        // Remove active class from all tabs and contents
        this.elements.tabBtns.forEach(b => b.classList.remove('active'));
        this.elements.tabContents.forEach(c => c.classList.remove('active'));
        
        // Add active class to clicked tab and corresponding content
        e.target.classList.add('active');
        document.getElementById(`${tabId}-tab`).classList.add('active');
        
        // Clear previous results when switching tabs
        this.clearAll();
    }

    // Extract video ID from YouTube URL
    getVideoId(url) {
        try {
            const yt = new URL(url);
            
            // Handle youtu.be URLs
            if (yt.hostname === 'youtu.be') {
                return yt.pathname.slice(1);
            }
            
            // Handle regular YouTube URLs
            if (yt.hostname.includes('youtube.com')) {
                return yt.searchParams.get('v');
            }
            
            return null;
        } catch (error) {
            console.error('Error extracting video ID:', error);
            return null;
        }
    }

    // Search for videos
    async searchVideos() {
        const query = this.elements.searchQuery.value.trim();
        if (!query) {
            this.showNotification('Please enter a search query', 'warning');
            return;
        }

        try {
            this.setButtonLoading(this.elements.searchBtn, 'Searching...');
            this.clearSearchResults();
            
            const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&max_results=20`);
            const data = await response.json();
            
            if (data.error) {
                this.showNotification('Search error: ' + data.error, 'error');
                return;
            }
            
            this.displaySearchResults(data.videos, query);
            
        } catch (error) {
            this.showNotification('Error searching videos: ' + error.message, 'error');
        } finally {
            this.setButtonLoading(this.elements.searchBtn, 'Search', false);
        }
    }

    // Display search results
    displaySearchResults(videos, query) {
        if (videos.length === 0) {
            this.elements.videoGrid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-search"></i>
                    <h3>No videos found</h3>
                    <p>Try different keywords or check your spelling</p>
                </div>
            `;
            this.elements.searchResults.style.display = 'block';
            this.elements.resultsCount.textContent = 'No results found';
            return;
        }

        this.elements.resultsCount.textContent = `Found ${videos.length} videos for "${query}"`;
        this.elements.searchResults.style.display = 'block';
        
        this.elements.videoGrid.innerHTML = videos.map(video => `
            <div class="video-card" data-video-url="${video.url}" data-video-id="${video.id}">
                <div style="position: relative;">
                    <img src="${video.thumbnail}" alt="${this.escapeHtml(video.title)}" class="video-thumbnail" loading="lazy">
                    <div class="video-duration">${video.duration_formatted}</div>
                </div>
                <div class="video-info">
                    <h3 class="video-title">${this.escapeHtml(video.title)}</h3>
                    <p class="video-author">${this.escapeHtml(video.author)}</p>
                    <div class="video-stats">
                        <span>${video.views_formatted} views</span>
                        <span><i class="fas fa-download"></i> Select to download</span>
                    </div>
                </div>
            </div>
        `).join('');

        // Add click handlers to video cards
        this.elements.videoGrid.querySelectorAll('.video-card').forEach(card => {
            card.addEventListener('click', () => this.selectVideoFromSearch(card));
        });

        // Smooth scroll to results
        this.elements.searchResults.scrollIntoView({ behavior: 'smooth' });
    }

    // Select video from search results
    selectVideoFromSearch(card) {
        // Remove previous selection
        document.querySelectorAll('.video-card').forEach(c => c.classList.remove('selected-video'));
        
        // Add selection to clicked card
        card.classList.add('selected-video');
        
        const videoUrl = card.dataset.videoUrl;
        const videoId = card.dataset.videoId;
        
        // Set the URL and fetch video info
        this.currentVideoUrl = videoUrl;
        this.currentVideoId = videoId;
        
        // Fetch detailed video info
        this.fetchVideoInfo(videoUrl);
    }

    // Fetch video from URL
    async fetchVideoFromUrl() {
        const url = this.elements.videoUrl.value.trim();
        if (!url) {
            this.showNotification('Please enter a YouTube URL', 'warning');
            return;
        }

        if (!this.getVideoId(url)) {
            this.showNotification('Please enter a valid YouTube URL', 'error');
            return;
        }

        try {
            this.setButtonLoading(this.elements.fetchBtn, 'Fetching...');
            this.currentVideoUrl = url;
            await this.fetchVideoInfo(url);
            
        } catch (error) {
            this.showNotification('Error fetching video information: ' + error.message, 'error');
        } finally {
            this.setButtonLoading(this.elements.fetchBtn, 'Fetch Video', false);
        }
    }

    // Fetch video information
    async fetchVideoInfo(url) {
        try {
            const response = await fetch(`/api/video_info?url=${encodeURIComponent(url)}`);
            const data = await response.json();
            
            if (data.error) {
                this.showNotification('Error: ' + data.error, 'error');
                return;
            }
            
            // Display video info
            this.elements.videoThumbnail.src = data.thumbnail;
            this.elements.videoTitle.textContent = data.title;
            this.elements.videoDuration.textContent = `Duration: ${data.duration_formatted}`;
            this.elements.videoViews.textContent = `Views: ${data.views_formatted}`;
            this.elements.videoAuthor.textContent = `Channel: ${data.author}`;
            
            this.elements.videoPreview.style.display = 'flex';
            this.elements.downloadOptions.style.display = 'grid';
            
            // Get video ID for progress tracking
            this.currentVideoId = this.getVideoId(url);
            
            // Smooth scroll to download options
            this.elements.downloadOptions.scrollIntoView({ behavior: 'smooth' });
            
        } catch (error) {
            this.showNotification('Error fetching video information: ' + error.message, 'error');
        }
    }

    // Quality selection
    selectQuality(btn) {
        // Remove active class from all buttons in the same group
        const siblings = Array.from(btn.parentElement.children);
        siblings.forEach(sibling => sibling.classList.remove('active'));
        
        // Add active class to clicked button
        btn.classList.add('active');
        this.selectedQuality = btn.dataset.quality;
    }

    // Start download process
    async startDownload(btn) {
        if (!this.currentVideoUrl) {
            this.showNotification('Please select a video first', 'warning');
            return;
        }
        
        const card = btn.closest('.option-card');
        const activeQuality = card.querySelector('.quality-btn.active');
        
        if (!activeQuality) {
            this.showNotification('Please select a quality option first', 'warning');
            return;
        }
        
        // Determine if it's audio or video download
        const isAudioDownload = btn.classList.contains('audio-download');
        
        try {
            // Disable download button and show loading state
            const originalText = btn.innerHTML;
            this.setButtonLoading(btn, 'Starting Download...');
            
            // Show progress bar
            this.showProgressBar();
            
            // Start download
            const response = await fetch('/api/download', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    url: this.currentVideoUrl,
                    quality: activeQuality.dataset.quality,
                    audio_only: isAudioDownload
                })
            });
            
            const data = await response.json();
            
            if (data.error) {
                this.showNotification('Error: ' + data.error, 'error');
                this.hideProgressBar();
                this.setButtonLoading(btn, originalText, false);
                return;
            }
            
            // Start polling for progress
            this.pollDownloadProgress(data.video_id, btn, originalText);
            
        } catch (error) {
            this.showNotification('Error starting download: ' + error.message, 'error');
            this.hideProgressBar();
            this.setButtonLoading(btn, btn.innerHTML.replace('<div class="loading"></div>', ''), false);
        }
    }

    // Poll download progress
    async pollDownloadProgress(videoId, btn, originalText) {
        let attempts = 0;
        const maxAttempts = 300; // 5 minutes with 1-second intervals
        
        this.downloadInterval = setInterval(async () => {
            attempts++;
            
            if (attempts > maxAttempts) {
                clearInterval(this.downloadInterval);
                this.hideProgressBar();
                this.setButtonLoading(btn, originalText, false);
                this.showNotification('Download timeout - please try again', 'error');
                return;
            }
            
            try {
                const progressResponse = await fetch(`/api/progress/${videoId}`);
                const progressData = await progressResponse.json();
                
                // if (progressData.status === 'error') {
                //     clearInterval(this.downloadInterval);
                //     this.showNotification('Download failed: ' + (progressData.error || 'Unknown error'), 'error');
                //     this.hideProgressBar();
                //     this.setButtonLoading(btn, originalText, false);
                //     return;
                // }
                
                if (progressData.progress !== undefined) {
                    const progressPercent = Math.round(progressData.progress);
                    this.updateProgress(progressPercent);
                    
                    // Update button text based on status
                    if (progressData.status === 'downloading') {
                        btn.innerHTML = `<i class="fas fa-download"></i> Downloading... ${progressPercent}%`;
                    } else if (progressData.status === 'processing') {
                        btn.innerHTML = '<i class="fas fa-cog fa-spin"></i> Processing...';
                    }
                    
                    if (progressData.status === 'completed') {
                        clearInterval(this.downloadInterval);
                        this.handleDownloadComplete(videoId, btn, originalText);
                    }
                }
            } catch (error) {
                console.error('Error checking progress:', error);
                // Don't clear interval on single error, might be temporary
            }
        }, 1000);
    }

    // Handle download completion
    async handleDownloadComplete(videoId, btn, originalText) {
        this.elements.progressText.textContent = 'Download Complete!';
        btn.innerHTML = '<i class="fas fa-check"></i> Download Complete!';
        
        // Wait a bit before attempting download
        setTimeout(async () => {
            try {
                const downloadResponse = await fetch(`/api/download_file/${videoId}`);
                
                if (downloadResponse.ok) {
                    // Create a blob and download it
                    const blob = await downloadResponse.blob();
                    const downloadUrl = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.style.display = 'none';
                    a.href = downloadUrl;
                    
                    // Try to get filename from headers
                    const contentDisposition = downloadResponse.headers.get('Content-Disposition');
                    let filename = 'download';
                    if (contentDisposition) {
                        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
                        if (filenameMatch && filenameMatch[1]) {
                            filename = filenameMatch[1].replace(/['"]/g, '');
                        }
                    }
                    a.download = filename;
                    
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(downloadUrl);
                    document.body.removeChild(a);
                    
                    this.showNotification('Download completed successfully!', 'success');
                } else {
                    // If response is not ok, it might be JSON error
                    const errorData = await downloadResponse.json();
                    this.showNotification('Download failed: ' + errorData.error, 'error');
                }
            } catch (downloadError) {
                console.error('Download error:', downloadError);
                // Fallback to direct link
                try {
                    window.location.href = `/api/download_file/${videoId}`;
                } catch (fallbackError) {
                    this.showNotification('Download failed. Please try again.', 'error');
                }
            }
            
            this.hideProgressBar();
            this.setButtonLoading(btn, originalText, false);
        }, 2000);
    }

    // Utility functions
    showProgressBar() {
        this.elements.progressBar.style.display = 'block';
        this.updateProgress(0);
    }

    hideProgressBar() {
        this.elements.progressBar.style.display = 'none';
    }

    updateProgress(percent) {
        this.elements.progress.style.width = `${percent}%`;
        this.elements.progressText.textContent = `${percent}%`;
    }

    setButtonLoading(button, text, isLoading = true) {
        button.disabled = isLoading;
        if (isLoading) {
            button.innerHTML = `<div class="loading"></div> ${text}`;
        } else {
            // Remove loading spinner if present
            button.innerHTML = text.replace('<div class="loading"></div> ', '');
            if (!button.innerHTML.includes('<i class="fas')) {
                // Add appropriate icon based on button type
                if (button.classList.contains('search-btn')) {
                    button.innerHTML = '<i class="fas fa-search"></i> ' + button.innerHTML;
                } else if (button.classList.contains('fetch-btn')) {
                    button.innerHTML = '<i class="fas fa-download"></i> ' + button.innerHTML;
                } else if (button.classList.contains('download-btn')) {
                    button.innerHTML = '<i class="fas fa-download"></i> ' + button.innerHTML;
                }
            }
        }
    }

    validateUrl(e) {
        const url = e.target.value;
        const videoId = this.getVideoId(url);
        
        if (url && !videoId) {
            e.target.style.borderColor = '#e74c3c';
        } else if (videoId) {
            e.target.style.borderColor = '#27ae60';
        } else {
            e.target.style.borderColor = '#95a5a6';
        }
    }

    clearSearchResults() {
        this.elements.searchResults.style.display = 'none';
        this.elements.videoGrid.innerHTML = '';
        this.elements.resultsCount.textContent = '';
    }

    clearVideoPreview() {
        this.elements.videoPreview.style.display = 'none';
        this.elements.downloadOptions.style.display = 'none';
        this.hideProgressBar();
    }

    clearAll() {
        this.clearSearchResults();
        this.clearVideoPreview();
        this.elements.searchQuery.value = '';
        this.elements.videoUrl.value = '';
        this.currentVideoId = null;
        this.currentVideoUrl = null;
        this.selectedQuality = null;
        
        // Clear any active intervals
        if (this.downloadInterval) {
            clearInterval(this.downloadInterval);
            this.downloadInterval = null;
        }
    }

    setupInputPlaceholders() {
        // Search input placeholders
        this.elements.searchQuery.addEventListener('focus', () => {
            if (this.elements.searchQuery.value === '') {
                this.elements.searchQuery.placeholder = 'Example: "music videos 2023", "how to cook pasta"';
            }
        });

        this.elements.searchQuery.addEventListener('blur', () => {
            this.elements.searchQuery.placeholder = 'Search for videos...';
        });

        // URL input placeholders
        this.elements.videoUrl.addEventListener('focus', () => {
            if (this.elements.videoUrl.value === '') {
                this.elements.videoUrl.placeholder = 'Example: https://www.youtube.com/watch?v=dQw4w9WgXcQ';
            }
        });

        this.elements.videoUrl.addEventListener('blur', () => {
            this.elements.videoUrl.placeholder = 'Paste YouTube URL here...';
        });
    }

    showNotification(message, type = 'success') {
        // Clear existing notification timeout
        if (this.notificationTimeout) {
            clearTimeout(this.notificationTimeout);
        }

        // Remove existing notification
        const existingNotification = document.querySelector('.notification');
        if (existingNotification) {
            existingNotification.remove();
        }

        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <i class="fas ${this.getNotificationIcon(type)}"></i>
            <span>${message}</span>
        `;

        // Add to DOM
        document.body.appendChild(notification);

        // Show notification
        setTimeout(() => notification.classList.add('show'), 100);

        // Auto-hide after 5 seconds
        this.notificationTimeout = setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 5000);
    }

    getNotificationIcon(type) {
        switch (type) {
            case 'success': return 'fa-check-circle';
            case 'error': return 'fa-exclamation-circle';
            case 'warning': return 'fa-exclamation-triangle';
            default: return 'fa-info-circle';
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.youtubeDownloader = new YouTubeDownloader();
});

// Add notification styles if not present
if (!document.querySelector('style[data-notification-styles]')) {
    const notificationStyles = document.createElement('style');
    notificationStyles.setAttribute('data-notification-styles', 'true');
    notificationStyles.textContent = `
        .notification {
            position: fixed;
            top: 20px;
            right: 20px;
            background-color: var(--success);
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 5px;
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
            z-index: 1000;
            transform: translateX(100%);
            transition: transform 0.3s;
            display: flex;
            align-items: center;
            gap: 10px;
            max-width: 300px;
        }

        .notification.show {
            transform: translateX(0);
        }

        .notification.error {
            background-color: #e74c3c;
        }

        .notification.warning {
            background-color: var(--warning);
        }

        .notification i {
            font-size: 1.2rem;
        }
    `;
    document.head.appendChild(notificationStyles);
}