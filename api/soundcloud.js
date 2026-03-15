const axios = require('axios');
const cheerio = require('cheerio');
const express = require('express');
const router = express.Router();

async function scrapeDowncloudme(url) {
    const headers = {
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'accept-language': 'en-US,en;q=0.9',
        'origin': 'https://downcloudme.com',
        'referer': 'https://downcloudme.com/soundcloud-playlist-downloader/',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'content-type': 'application/x-www-form-urlencoded'
    };

    try {
        const params = new URLSearchParams();
        params.append('url', url);

        const response = await axios.post('https://downcloudme.com/download', params.toString(), { 
            headers,
            timeout: 30000 
        });
        
        const $ = cheerio.load(response.data);
        const tracks = [];

        $('.custom-track-container').each((i, el) => {
            const title = $(el).find('.custom-track-title').text().trim();
            const image = $(el).find('.custom-track-image').attr('src');
            const detailsText = $(el).find('.custom-track-details').text();
            
            const durationMatch = detailsText.match(/Duration:\s*([^\n]+)/);
            const likesMatch = detailsText.match(/Likes:\s*([^\n]+)/);
            
            const duration = durationMatch ? durationMatch[1].trim() : '';
            const likes = likesMatch ? likesMatch[1].trim() : '';
            const downloadLink = $(el).find('.custom-download-btn').attr('href');

            if (title && downloadLink) {
                tracks.push({
                    id: `sc_${Date.now()}_${i}`,
                    title,
                    artist: extractArtist(title),
                    image: image || 'https://via.placeholder.com/300x300?text=No+Image',
                    duration: parseDuration(duration),
                    durationText: duration,
                    likes,
                    downloadUrl: downloadLink.startsWith('http') 
                        ? downloadLink 
                        : `https://downcloudme.com${downloadLink}`,
                    sourceUrl: url,
                    type: 'soundcloud'
                });
            }
        });

        return tracks;
    } catch (error) {
        console.error('Scraper error:', error.message);
        throw new Error('Failed to scrape SoundCloud');
    }
}

function extractArtist(title) {
    const separators = [' - ', ' – ', ' — ', ' | '];
    for (let sep of separators) {
        if (title.includes(sep)) {
            return title.split(sep)[0].trim();
        }
    }
    return 'Unknown Artist';
}

function parseDuration(durationStr) {
    if (!durationStr) return 0;
    const parts = durationStr.split(':').map(Number);
    if (parts.length === 2) {
        return parts[0] * 60 + parts[1];
    } else if (parts.length === 3) {
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    return 0;
}

router.post('/resolve', async (req, res) => {
    try {
        const { url } = req.body;
        
        if (!url || !url.includes('soundcloud.com')) {
            return res.status(400).json({ 
                error: 'Invalid SoundCloud URL' 
            });
        }

        const tracks = await scrapeDowncloudme(url);
        
        if (tracks.length === 0) {
            return res.status(404).json({ 
                error: 'No tracks found or URL is private' 
            });
        }

        res.json({
            success: true,
            count: tracks.length,
            tracks: tracks
        });

    } catch (error) {
        res.status(500).json({ 
            error: error.message 
        });
    }
});

router.get('/search', async (req, res) => {
    try {
        const { q } = req.query;
        const clientId = process.env.SOUNDCLOUD_CLIENT_ID || 'YOUR_CLIENT_ID';
        
        const response = await axios.get(
            `https://api.soundcloud.com/search/tracks?q=${encodeURIComponent(q)}&client_id=${clientId}&limit=20`
        );
        
        const tracks = response.data.collection.map(track => ({
            id: track.id,
            title: track.title,
            artist: track.user.username,
            image: track.artwork_url ? track.artwork_url.replace('large', 't300x300') : track.user.avatar_url,
            duration: Math.floor(track.duration / 1000),
            streamUrl: track.stream_url,
            permalink: track.permalink_url
        }));
        
        res.json({ success: true, tracks });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
