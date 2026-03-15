const API_CONFIG = {
    LOCAL: {
        BASE_URL: window.location.origin.includes('localhost') 
            ? 'http://localhost:3000/api' 
            : 'https://your-domain.com/api',
        RESOLVE: '/soundcloud/resolve',
        SEARCH: '/soundcloud/search'
    },
    
    SCRAPER: {
        BASE_URL: 'https://downcloudme.com',
        DOWNLOAD: '/download'
    },
    
    WIDGET: {
        BASE_URL: 'https://w.soundcloud.com/player',
        RESOLVE: 'https://soundcloud.com/oembed'
    }
};

const APP_DEFAULTS = {
    DEFAULT_SEARCH: 'popular electronic',
    MAX_RECENT_ITEMS: 10,
    MAX_QUEUE_ITEMS: 20,
    STORAGE_KEY: 'sc_recentlyPlayed',
    CURRENT_PLAYLIST: 'sc_currentPlaylist'
};

export { API_CONFIG, APP_DEFAULTS };
