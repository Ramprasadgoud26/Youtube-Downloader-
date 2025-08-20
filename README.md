# YouTube Video Downloader

A Flask-based web application that allows you to search, preview, and download YouTube videos in various qualities or as audio-only files.

## Features

- 🔍 **YouTube Search**: Search for videos directly within the app
- 📹 **Multiple Quality Options**: Download videos in 144p, 240p, 360p, 480p, 720p, 1080p, or highest available quality
- 🎵 **Audio-Only Downloads**: Extract audio as MP3 files
- 📊 **Real-time Progress Tracking**: Monitor download progress with live updates
- 🎬 **Video Preview**: View video information, thumbnails, duration, and view counts
- 🧹 **Auto Cleanup**: Automatically removes old downloads after 1 hour
- 🔒 **Safe Downloads**: Sanitized filenames and security checks

## Prerequisites

- Python 3.7 or higher
- FFmpeg (required for audio extraction and video processing)

### Installing FFmpeg

**Windows:**
```bash
# Using chocolatey
choco install ffmpeg

# Or download from https://ffmpeg.org/download.html
```

**macOS:**
```bash
brew install ffmpeg
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install ffmpeg
```

## Installation

1. **Clone the repository:**
```bash
git clone https://github.com/yourusername/youtube-downloader.git
cd youtube-downloader
```

2. **Create a virtual environment:**
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. **Install dependencies:**
```bash
pip install -r requirements.txt
```

4. **Create requirements.txt if not present:**
```bash
pip install flask yt-dlp
pip freeze > requirements.txt
```

## Usage

1. **Start the application:**
```bash
python app.py
```

2. **Open your browser and navigate to:**
```
http://localhost:5000
```

3. **Using the application:**
   - **Search**: Enter keywords in the search box to find YouTube videos
   - **Direct URL**: Paste a YouTube URL directly
   - **Select Quality**: Choose video quality or audio-only option
   - **Download**: Click download and monitor progress
   - **Download File**: Once complete, click to download your file

## API Endpoints

### Search Videos
```http
GET /api/search?q={query}&max_results={number}
```

### Get Video Information
```http
GET /api/video_info?url={youtube_url}
```

### Start Download
```http
POST /api/download
Content-Type: application/json

{
  "url": "youtube_url",
  "quality": "720p",
  "audio_only": false
}
```

### Check Download Progress
```http
GET /api/progress/{video_id}
```

### Download File
```http
GET /api/download_file/{video_id}
```

## Project Structure

```
youtube-downloader/
├── app.py                 # Main Flask application
├── requirements.txt       # Python dependencies
├── downloads/            # Downloaded files directory (auto-created)
├── templates/
│   └── index.html        # Web interface template
├── static/
│   ├── css/
│   ├── js/
│   └── images/
└── README.md            # This file
```

## Configuration

The application uses the following default settings:

- **Download Folder**: `downloads/`
- **Max File Age**: 1 hour (auto-cleanup)
- **Host**: `0.0.0.0`
- **Port**: `5000`
- **Max Search Results**: 20

You can modify these settings in `app.py`:

```python
app.config['DOWNLOAD_FOLDER'] = 'downloads'
app.config['MAX_DOWNLOAD_AGE'] = timedelta(hours=1)
```

## Supported Formats

### Video Qualities
- 144p, 240p, 360p, 480p, 720p, 1080p
- Highest available quality

### Audio Format
- MP3 (192 kbps)

## Features in Detail

### Automatic Cleanup
- Downloaded files are automatically removed after 1 hour
- Prevents disk space issues from accumulating downloads

### Progress Tracking
- Real-time download progress updates
- Status indicators: starting, downloading, processing, completed, error

### Security Features
- Filename sanitization to prevent directory traversal attacks
- File size validation
- Secure file serving with proper headers

### Error Handling
- Comprehensive error logging
- Graceful failure handling
- User-friendly error messages

## Troubleshooting

### Common Issues

**1. "FFmpeg not found" error:**
- Install FFmpeg following the prerequisites section
- Ensure FFmpeg is in your system PATH

**2. Downloads failing:**
- Check if the YouTube URL is valid and accessible
- Some videos may be region-restricted or private
- Verify internet connection

**3. Files not found after download:**
- Check the `downloads/` directory exists
- Verify sufficient disk space
- Check file permissions

**4. Import errors:**
- Ensure all dependencies are installed: `pip install -r requirements.txt`
- Activate your virtual environment

### Debugging

Enable debug mode by setting:
```python
app.run(debug=True, host='0.0.0.0', port=5000)
```

Check logs for detailed error information.

## Legal Disclaimer

This tool is for educational purposes only. Users are responsible for complying with YouTube's Terms of Service and applicable copyright laws. Only download content you have the right to download.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Changelog

### v1.0.0
- Initial release
- YouTube search functionality
- Multiple quality downloads
- Audio-only downloads
- Progress tracking
- Auto-cleanup feature

## Support

If you encounter any issues or have questions:

1. Check the [Issues](https://github.com/yourusername/youtube-downloader/issues) page
2. Create a new issue with detailed information about the problem
3. Include your Python version, OS, and error messages

## Acknowledgments

- [yt-dlp](https://github.com/yt-dlp/yt-dlp) - The core YouTube downloading library
- [Flask](https://flask.palletsprojects.com/) - Web framework
- [FFmpeg](https://ffmpeg.org/) - Video and audio processing

---

⭐ Star this repository if you find it helpful!
