import { API_CONFIG, APP_DEFAULTS } from './config.js';

class SoundCloudPlayer {
    constructor() {
        this.currentTrack = null;
        this.playlist = [];
        this.recentTracks = JSON.parse(localStorage.getItem(APP_DEFAULTS.STORAGE_KEY)) || [];
        this.isPlaying = false;
        this.audioPlayer = new Audio();
        this.widget = null;
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.loadRecentTracks();
        this.setupAudioEvents();
    }
    
    setupEventListeners() {
        document.getElementById('resolveBtn').addEventListener('click', () => {
            const url = document.getElementById('scUrlInput').value.trim();
            if (url) this.resolveUrl(url);
        });
        
        document.getElementById('searchBtn').addEventListener('click', () => {
            const query = document.getElementById('searchInput').value.trim();
            if (query) this.searchTracks(query);
        });
        
        document.getElementById('scUrlInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const url = e.target.value.trim();
                if (url) this.resolveUrl(url);
            }
        });
        
        document.getElementById('searchInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const query = e.target.value.trim();
                if (query) this.searchTracks(query);
            }
        });
        
        document.getElementById('playPauseBtn').addEventListener('click', () => this.togglePlay());
        document.getElementById('prevBtn').addEventListener('click', () => this.playPrevious());
        document.getElementById('nextBtn').addEventListener('click', () => this.playNext());
        document.getElementById('downloadBtn').addEventListener('click', () => this.downloadCurrent());
    }
    
    setupAudioEvents() {
        this.audioPlayer.addEventListener('ended', () => this.playNext());
        this.audioPlayer.addEventListener('timeupdate', () => this.updateProgress());
        this.audioPlayer.addEventListener('loadedmetadata', () => this.updateDuration());
    }
    
    async resolveUrl(url) {
        this.showLoading(true);
        
        try {
            const response = await fetch(`${API_CONFIG.LOCAL.BASE_URL}${API_CONFIG.LOCAL.RESOLVE}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.playlist = data.tracks;
                this.displayResults(data.tracks);
                this.showToast(`Found ${data.count} tracks`);
            } else {
                throw new Error(data.error || 'Failed to resolve URL');
            }
        } catch (error) {
            console.error('Resolve error:', error);
            this.showError('Failed to fetch tracks. Make sure the URL is public.');
            
            this.tryWidgetEmbed(url);
        } finally {
            this.showLoading(false);
        }
    }
    
    async searchTracks(query) {
        this.showLoading(true);
        
        try {
            const response = await fetch(
                `${API_CONFIG.LOCAL.BASE_URL}${API_CONFIG.LOCAL.SEARCH}?q=${encodeURIComponent(query)}`
            );
            
            const data = await response.json();
            
            if (data.success) {
                this.playlist = data.tracks;
                this.displayResults(data.tracks, true); 
            } else {
                throw new Error(data.error);
            }
        } catch (error) {
            console.error('Search error:', error);
            this.showError('Search failed. Please try again.');
        } finally {
            this.showLoading(false);
        }
    }
    
    displayResults(tracks, useWidget = false) {
        const container = document.getElementById('searchResults');
        container.innerHTML = '';
        
        tracks.forEach((track, index) => {
            const card = document.createElement('div');
            card.className = 'track-card';
            card.innerHTML = `
                <div class="track-image">
                    <img src="${track.image}" alt="${track.title}" loading="lazy">
                    <button class="play-overlay" onclick="player.playTrack(${index}, ${useWidget})">
                        <i class="fas fa-play"></i>
                    </button>
                </div>
                <div class="track-info">
                    <h3 class="track-title">${this.escapeHtml(track.title)}</h3>
                    <p class="track-artist">${this.escapeHtml(track.artist)}</p>
                    ${track.durationText ? `<span class="track-duration">${track.durationText}</span>` : ''}
                    ${track.likes ? `<span class="track-likes"><i class="fas fa-heart"></i> ${track.likes}</span>` : ''}
                </div>
                <div class="track-actions">
                    <button onclick="player.addToQueue(${index})" title="Add to Queue">
                        <i class="fas fa-plus"></i>
                    </button>
                    <button onclick="player.downloadTrack(${index})" title="Download">
                        <i class="fas fa-download"></i>
                    </button>
                </div>
            `;
            container.appendChild(card);
        });
    }
    
    async playTrack(index, useWidget = false) {
        const track = this.playlist[index];
        if (!track) return;
        
        this.currentTrack = { ...track, index };
        
        if (useWidget && track.permalink) {
            this.loadWidget(track.permalink);
        } else if (track.downloadUrl) {
            this.loadAudio(track.downloadUrl);
        } else {
            this.loadWidget(track.sourceUrl || track.permalink);
        }
        
        this.updatePlayerUI(track);
        this.addToRecent(track);
        this.isPlaying = true;
        this.updatePlayButton();
    }
    
    loadAudio(url) {
        document.getElementById('widgetContainer').innerHTML = '';
        
        this.audioPlayer.src = url;
        this.audioPlayer.play().catch(err => {
            console.error('Audio play error:', err);
            this.showError('Cannot play this track directly. Try using SoundCloud app.');
        });
    }
    
    loadWidget(permalink) {
        const container = document.getElementById('widgetContainer');
        const encodedUrl = encodeURIComponent(permalink);
        
        container.innerHTML = `
            <iframe 
                width="100%" 
                height="166" 
                scrolling="no" 
                frameborder="no" 
                allow="autoplay" 
                src="https://w.soundcloud.com/player/?url=${encodedUrl}&color=ff5500&auto_play=true&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false">
            </iframe>
        `;
        
        this.audioPlayer.pause();
    }
    
    downloadTrack(index) {
        const track = this.playlist[index];
        if (!track || !track.downloadUrl) {
            this.showError('Download not available for this track');
            return;
        }
        
        const a = document.createElement('a');
        a.href = track.downloadUrl;
        a.download = `${track.title}.mp3`;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        this.showToast('Download started...');
    }
    
    downloadCurrent() {
        if (this.currentTrack) {
            this.downloadTrack(this.currentTrack.index);
        }
    }
    
    addToQueue(index) {
        const track = this.playlist[index];
        this.showToast('Added to queue');
    }
    
    togglePlay() {
        if (!this.currentTrack) return;
        
        if (document.getElementById('widgetContainer').innerHTML) {
            this.showToast('Use SoundCloud widget controls');
            return;
        }
        
        if (this.isPlaying) {
            this.audioPlayer.pause();
        } else {
            this.audioPlayer.play();
        }
        this.isPlaying = !this.isPlaying;
        this.updatePlayButton();
    }
    
    playNext() {
        if (!this.currentTrack || this.playlist.length === 0) return;
        
        const nextIndex = (this.currentTrack.index + 1) % this.playlist.length;
        this.playTrack(nextIndex);
    }
    
    playPrevious() {
        if (!this.currentTrack || this.playlist.length === 0) return;
        
        const prevIndex = this.currentTrack.index === 0 
            ? this.playlist.length - 1 
            : this.currentTrack.index - 1;
        this.playTrack(prevIndex);
    }
    
    updatePlayerUI(track) {
        document.getElementById('currentTitle').textContent = track.title;
        document.getElementById('currentArtist').textContent = track.artist;
        document.getElementById('currentImage').src = track.image;
        document.getElementById('playerContainer').classList.add('active');
    }
    
    updatePlayButton() {
        const btn = document.getElementById('playPauseBtn');
        btn.innerHTML = this.isPlaying 
            ? '<i class="fas fa-pause"></i>' 
            : '<i class="fas fa-play"></i>';
    }
    
    updateProgress() {
        const progress = (this.audioPlayer.currentTime / this.audioPlayer.duration) * 100;
        document.getElementById('progressBar').style.width = `${progress}%`;
        document.getElementById('currentTime').textContent = this.formatTime(this.audioPlayer.currentTime);
    }
    
    updateDuration() {
        document.getElementById('totalTime').textContent = this.formatTime(this.audioPlayer.duration);
    }
    
    addToRecent(track) {
        this.recentTracks = this.recentTracks.filter(t => t.id !== track.id);
        this.recentTracks.unshift(track);
        if (this.recentTracks.length > APP_DEFAULTS.MAX_RECENT_ITEMS) {
            this.recentTracks.pop();
        }
        localStorage.setItem(APP_DEFAULTS.STORAGE_KEY, JSON.stringify(this.recentTracks));
        this.loadRecentTracks();
    }
    
    loadRecentTracks() {
        const container = document.getElementById('recentTracks');
        container.innerHTML = '';
        
        this.recentTracks.forEach((track, index) => {
            const item = document.createElement('div');
            item.className = 'recent-item';
            item.innerHTML = `
                <img src="${track.image}" alt="${track.title}">
                <div class="recent-info">
                    <div class="recent-title">${this.escapeHtml(track.title)}</div>
                    <div class="recent-artist">${this.escapeHtml(track.artist)}</div>
                </div>
                <button onclick="player.playFromRecent(${index})">
                    <i class="fas fa-play"></i>
                </button>
            `;
            container.appendChild(item);
        });
    }
    
    playFromRecent(index) {
        const track = this.recentTracks[index];
        this.playlist = [track];
        this.playTrack(0);
    }
    
    showLoading(show) {
        document.getElementById('loading').style.display = show ? 'flex' : 'none';
    }
    
    showError(message) {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = 'toast error';
        toast.style.display = 'block';
        setTimeout(() => toast.style.display = 'none', 3000);
    }
    
    showToast(message) {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = 'toast';
        toast.style.display = 'block';
        setTimeout(() => toast.style.display = 'none', 2000);
    }
    
    formatTime(seconds) {
        if (isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    tryWidgetEmbed(url) {
        this.loadWidget(url);
        this.showToast('Using SoundCloud widget mode');
    }
}

const player = new SoundCloudPlayer();
window.player = player; 
