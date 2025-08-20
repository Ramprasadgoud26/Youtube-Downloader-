from flask import Flask, render_template, request, send_file, jsonify
import yt_dlp
import os
import threading
import time
import re
import logging
from urllib.parse import urlparse, parse_qs
from datetime import datetime, timedelta

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config['DOWNLOAD_FOLDER'] = 'downloads'
app.config['MAX_DOWNLOAD_AGE'] = timedelta(hours=1)  # Clean up files older than 1 hour

# Ensure download directory exists
if not os.path.exists(app.config['DOWNLOAD_FOLDER']):
    os.makedirs(app.config['DOWNLOAD_FOLDER'])

# Store download progress and metadata
download_progress = {}
download_metadata = {}

def sanitize_filename(filename):
    """Remove invalid characters from filename"""
    # Remove invalid file characters
    filename = re.sub(r'[<>:"/\\|?*]', '', filename)
    # Replace spaces with underscores
    filename = filename.replace(' ', '_')
    # Limit length to avoid OS path limits
    if len(filename) > 150:
        filename = filename[:150]
    return filename

def cleanup_old_files():
    """Remove files older than MAX_DOWNLOAD_AGE"""
    try:
        now = datetime.now()
        for filename in os.listdir(app.config['DOWNLOAD_FOLDER']):
            filepath = os.path.join(app.config['DOWNLOAD_FOLDER'], filename)
            if os.path.isfile(filepath):
                file_time = datetime.fromtimestamp(os.path.getctime(filepath))
                if now - file_time > app.config['MAX_DOWNLOAD_AGE']:
                    os.remove(filepath)
                    logger.info(f"Removed old file: {filename}")
    except Exception as e:
        logger.error(f"Error in cleanup_old_files: {e}")

def format_duration(duration):
    """Format duration from seconds to HH:MM:SS or MM:SS"""
    if not duration:
        return "Unknown"
    
    hours = int(duration // 3600)
    minutes = int((duration % 3600) // 60)
    seconds = int(duration % 60)
    
    if hours > 0:
        return f"{hours}:{minutes:02d}:{seconds:02d}"
    else:
        return f"{minutes}:{seconds:02d}"

def format_views(views):
    """Format view count in a readable format"""
    if not views:
        return "Unknown"
    
    if views >= 1000000:
        return f"{views / 1000000:.1f}M"
    elif views >= 1000:
        return f"{views / 1000:.1f}K"
    else:
        return str(views)

def search_youtube_videos(query, max_results=20):
    """Search for YouTube videos using yt-dlp"""
    try:
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'skip_download': True,
            'extract_flat': False,  # Get detailed info
        }
        
        search_query = f"ytsearch{max_results}:{query}"
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            search_results = ydl.extract_info(search_query, download=False)
            
            videos = []
            if 'entries' in search_results:
                for entry in search_results['entries']:
                    if entry:  # Sometimes entries can be None
                        video_info = {
                            'id': entry.get('id', ''),
                            'title': entry.get('title', 'Unknown Title'),
                            'thumbnail': entry.get('thumbnail', ''),
                            'duration': entry.get('duration', 0),
                            'duration_formatted': format_duration(entry.get('duration', 0)),
                            'views': entry.get('view_count', 0),
                            'views_formatted': format_views(entry.get('view_count', 0)),
                            'author': entry.get('uploader', 'Unknown Author'),
                            'url': f"https://www.youtube.com/watch?v={entry.get('id', '')}",
                            'description': entry.get('description', '')[:200] + '...' if entry.get('description') else '',
                            'upload_date': entry.get('upload_date', '')
                        }
                        videos.append(video_info)
            
            return videos
    except Exception as e:
        logger.error(f"Error in search_youtube_videos: {e}")
        return []

def get_video_info(url):
    try:
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'skip_download': True,
        }
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            
            video_info = {
                'title': info.get('title', 'Unknown Title'),
                'thumbnail': info.get('thumbnail', ''),
                'duration': info.get('duration', 0),
                'duration_formatted': format_duration(info.get('duration', 0)),
                'views': info.get('view_count', 0),
                'views_formatted': format_views(info.get('view_count', 0)),
                'author': info.get('uploader', 'Unknown Author'),
                'video_id': info.get('id', ''),
                'description': info.get('description', '')[:300] + '...' if info.get('description') else '',
                'upload_date': info.get('upload_date', '')
            }
            return video_info
    except Exception as e:
        logger.error(f"Error in get_video_info: {e}")
        return {'error': str(e)}

def get_video_id(url):
    """Extract video ID from YouTube URL"""
    try:
        # List of domains that YouTube uses
        youtube_domains = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be']
        
        parsed_url = urlparse(url)
        domain = parsed_url.netloc.lower()
        
        # Check if the domain is a YouTube domain
        if any(youtube_domain in domain for youtube_domain in youtube_domains):
            if 'youtu.be' in domain:
                # For shortened youtu.be URLs
                return parsed_url.path[1:] if parsed_url.path else None
            else:
                # For standard YouTube URLs
                query_params = parse_qs(parsed_url.query)
                return query_params.get('v', [None])[0]
        return None
    except Exception as e:
        logger.error(f"Error in get_video_id: {e}")
        return None

def progress_hook(d, video_id):
    """Progress hook for yt-dlp downloads"""
    if video_id not in download_progress:
        return
        
    if d['status'] == 'downloading':
        total_bytes = d.get('total_bytes') or d.get('total_bytes_estimate') or 1
        downloaded_bytes = d.get('downloaded_bytes', 0)
        progress_percent = (downloaded_bytes / total_bytes) * 100
        
        download_progress[video_id]['progress'] = progress_percent
        download_progress[video_id]['status'] = 'downloading'
        download_progress[video_id]['downloaded_bytes'] = downloaded_bytes
        download_progress[video_id]['total_bytes'] = total_bytes
        
    elif d['status'] == 'finished':
        download_progress[video_id]['progress'] = 100
        download_progress[video_id]['status'] = 'processing'  # Set to processing, will be updated to completed later
        download_progress[video_id]['filepath'] = d['filename']
        logger.info(f"Download finished. File path: {d['filename']}")

def download_video(url, quality, audio_only=False):
    """Download video with improved error handling and file tracking"""
    video_id = get_video_id(url)
    if not video_id:
        logger.error("Could not extract video ID from URL")
        return None, "Could not extract video ID from URL"
    
    try:
        # Clean up old files before starting new download
        cleanup_old_files()
        
        # Set up options for yt-dlp with better filename handling
        ydl_opts = {
            'outtmpl': os.path.join(app.config['DOWNLOAD_FOLDER'], '%(title)s_%(id)s.%(ext)s'),
            'progress_hooks': [lambda d: progress_hook(d, video_id)],
            'quiet': False,
            'no_warnings': False,
            'restrictfilenames': True,  # This helps with filename issues
        }
        
        if audio_only:
            # Download audio only
            ydl_opts['format'] = 'bestaudio/best'
            ydl_opts['postprocessors'] = [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            }]
        else:
            # Download video with specified quality
            quality_map = {
                '144p': 'bestvideo[height<=144]+bestaudio/best[height<=144]',
                '240p': 'bestvideo[height<=240]+bestaudio/best[height<=240]',
                '360p': 'bestvideo[height<=360]+bestaudio/best[height<=360]',
                '480p': 'bestvideo[height<=480]+bestaudio/best[height<=480]',
                '720p': 'bestvideo[height<=720]+bestaudio/best[height<=720]',
                '1080p': 'bestvideo[height<=1080]+bestaudio/best[height<=1080]',
                'highest': 'bestvideo+bestaudio/best'
            }
            ydl_opts['format'] = quality_map.get(quality, 'bestvideo+bestaudio/best')
        
        # Initialize download progress
        download_progress[video_id] = {
            'progress': 0, 
            'filename': None, 
            'filepath': None,
            'status': 'starting',
            'start_time': time.time()
        }
        
        # Start download
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            
            # Store metadata immediately after getting info
            download_metadata[video_id] = {
                'title': info.get('title', 'Unknown'),
                'download_time': datetime.now().isoformat(),
                'url': url,
                'quality': quality,
                'audio_only': audio_only
            }
            
            # Wait a bit for file processing to complete
            time.sleep(2)
            
            # Try to find the downloaded file
            actual_file = None
            expected_filename = ydl.prepare_filename(info)
            
            # If audio_only and we have post-processors, the extension might have changed
            if audio_only:
                base_name = os.path.splitext(expected_filename)[0]
                expected_filename = base_name + '.mp3'
            
            logger.info(f"Expected filename: {expected_filename}")
            
            # Check if the exact file exists
            if os.path.exists(expected_filename) and os.path.getsize(expected_filename) > 0:
                actual_file = expected_filename
            else:
                # Search for similar files in the download directory
                try:
                    download_dir = app.config['DOWNLOAD_FOLDER']
                    for f in os.listdir(download_dir):
                        file_path = os.path.join(download_dir, f)
                        if os.path.isfile(file_path) and os.path.getsize(file_path) > 0:
                            # Check if the video ID is in the filename
                            if video_id in f:
                                actual_file = file_path
                                logger.info(f"Found file by video ID: {f}")
                                break
                    
                    # If still not found, get the most recent file
                    if not actual_file:
                        files_with_time = []
                        for f in os.listdir(download_dir):
                            file_path = os.path.join(download_dir, f)
                            if os.path.isfile(file_path) and os.path.getsize(file_path) > 0:
                                mtime = os.path.getmtime(file_path)
                                files_with_time.append((file_path, f, mtime))
                        
                        if files_with_time:
                            # Sort by modification time (most recent first)
                            files_with_time.sort(key=lambda x: x[2], reverse=True)
                            actual_file = files_with_time[0][0]
                            logger.info(f"Using most recent file: {files_with_time[0][1]}")
                            
                except Exception as e:
                    logger.error(f"Error searching for downloaded file: {e}")
            
            if actual_file:
                final_filename = os.path.basename(actual_file)
                
                # Update progress and metadata with final file info
                download_progress[video_id]['filename'] = final_filename
                download_progress[video_id]['filepath'] = actual_file
                download_progress[video_id]['status'] = 'completed'
                download_progress[video_id]['end_time'] = time.time()
                
                download_metadata[video_id]['filename'] = final_filename
                
                logger.info(f"Download completed successfully: {actual_file}")
                return actual_file, None
            else:
                error_msg = "Download completed but file not found"
                download_progress[video_id]['status'] = 'error'
                download_progress[video_id]['error'] = error_msg
                logger.error(f"File not found after download. Expected: {expected_filename}")
                return None, error_msg
                
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Error in download_video: {error_msg}")
        if video_id in download_progress:
            download_progress[video_id]['status'] = 'error'
            download_progress[video_id]['error'] = error_msg
        return None, error_msg

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/search', methods=['GET'])
def search_videos():
    query = request.args.get('q', '').strip()
    max_results = int(request.args.get('max_results', 20))
    
    if not query:
        return jsonify({'error': 'No search query provided'})
    
    try:
        videos = search_youtube_videos(query, max_results)
        return jsonify({'videos': videos, 'total': len(videos)})
    except Exception as e:
        logger.error(f"Search error: {e}")
        return jsonify({'error': str(e)})

@app.route('/api/video_info', methods=['GET'])
def video_info():
    url = request.args.get('url')
    if not url:
        return jsonify({'error': 'No URL provided'})
    
    info = get_video_info(url)
    return jsonify(info)

@app.route('/api/download', methods=['POST'])
def download():
    data = request.json
    url = data.get('url')
    quality = data.get('quality')
    audio_only = data.get('audio_only', False)
    
    if not url:
        return jsonify({'error': 'No URL provided'})
    
    # Get video ID for progress tracking
    video_id = get_video_id(url)
    if not video_id:
        return jsonify({'error': 'Could not extract video ID from URL'})
    
    # Clean up any previous state for this video
    if video_id in download_progress:
        del download_progress[video_id]
    if video_id in download_metadata:
        del download_metadata[video_id]
    
    # Start download in a separate thread
    thread = threading.Thread(target=download_video, args=(url, quality, audio_only))
    thread.daemon = True
    thread.start()
    
    return jsonify({'video_id': video_id})

@app.route('/api/progress/<video_id>', methods=['GET'])
def progress(video_id):
    if video_id in download_progress:
        progress_data = download_progress[video_id].copy()
        
        # If download is completed, verify file still exists
        if progress_data.get('status') == 'completed':
            filename = progress_data.get('filename')
            if filename:
                file_path = os.path.join(app.config['DOWNLOAD_FOLDER'], filename)
                if not os.path.exists(file_path):
                    progress_data['status'] = 'error'
                    progress_data['error'] = 'Downloaded file not found'
        
        return jsonify(progress_data)
    return jsonify({'progress': 0, 'status': 'not found'})

@app.route('/api/download_file/<video_id>', methods=['GET'])
def download_file(video_id):
    """Handle file download requests"""
    logger.info(f"Download file requested for video_id: {video_id}")
    logger.info(f"Available metadata keys: {list(download_metadata.keys())}")
    
    # Check if we have metadata for this video
    if video_id not in download_metadata:
        logger.warning(f"No metadata found for video_id: {video_id}")
        
        # Try to find any recent download files as fallback
        try:
            recent_files = []
            current_time = time.time()
            for filename in os.listdir(app.config['DOWNLOAD_FOLDER']):
                filepath = os.path.join(app.config['DOWNLOAD_FOLDER'], filename)
                if os.path.isfile(filepath):
                    file_age = current_time - os.path.getctime(filepath)
                    file_size = os.path.getsize(filepath)
                    if file_age < 300 and file_size > 0:  # Files from last 5 minutes
                        recent_files.append((filepath, filename, file_age))
            
            if recent_files:
                # Sort by creation time, get the most recent
                recent_files.sort(key=lambda x: x[2])  # Sort by age (ascending)
                most_recent = recent_files[0]
                logger.info(f"Using most recent file as fallback: {most_recent[1]}")
                
                # Create temporary metadata
                download_metadata[video_id] = {
                    'filename': most_recent[1],
                    'title': 'Downloaded Video',
                    'download_time': datetime.now().isoformat()
                }
                
        except Exception as e:
            logger.error(f"Error finding fallback file: {e}")
            return jsonify({'error': 'Download not found or expired'}), 404
        
        if video_id not in download_metadata:
            return jsonify({'error': 'Download not found or expired'}), 404
    
    filename = download_metadata[video_id]['filename']
    filepath = os.path.join(app.config['DOWNLOAD_FOLDER'], filename)
    
    logger.info(f"Looking for file: {filepath}")
    
    # Security check to prevent directory traversal
    if '..' in filename or filename.startswith('/'):
        logger.warning(f"Invalid filename detected: {filename}")
        return jsonify({'error': 'Invalid filename'}), 400
    
    # Check if file exists and is not empty
    if os.path.exists(filepath) and os.path.getsize(filepath) > 0:
        # Get the title for download name
        title = download_metadata[video_id].get('title', 'video')
        safe_title = sanitize_filename(title)
        file_extension = os.path.splitext(filename)[1]
        download_name = f"{safe_title}{file_extension}"
        
        logger.info(f"Sending file: {filepath} as {download_name}")
        
        # Clean up the progress and metadata AFTER successful response
        def cleanup_after_send():
            try:
                time.sleep(5)  # Wait 5 seconds before cleanup
                if video_id in download_progress:
                    del download_progress[video_id]
                if video_id in download_metadata:
                    del download_metadata[video_id]
            except Exception as e:
                logger.error(f"Error in cleanup: {e}")
        
        try:
            response = send_file(filepath, as_attachment=True, download_name=download_name)
            # Schedule cleanup after response is sent
            cleanup_thread = threading.Thread(target=cleanup_after_send)
            cleanup_thread.daemon = True
            cleanup_thread.start()
            return response
        except Exception as send_error:
            logger.error(f"Error sending file: {send_error}")
            return jsonify({'error': 'Error sending file'}), 500
    
    # If file not found, try to find a similar file
    logger.warning(f"File not found at expected path: {filepath}")
    try:
        for f in os.listdir(app.config['DOWNLOAD_FOLDER']):
            file_path = os.path.join(app.config['DOWNLOAD_FOLDER'], f)
            if os.path.isfile(file_path) and os.path.getsize(file_path) > 0:
                # Match by video ID or filename similarity
                if video_id in f or f.startswith(os.path.splitext(filename)[0][:20]):
                    logger.info(f"Found similar file: {f}")
                    # Update metadata
                    download_metadata[video_id]['filename'] = f
                    
                    def cleanup_similar():
                        try:
                            time.sleep(5)
                            if video_id in download_progress:
                                del download_progress[video_id]
                            if video_id in download_metadata:
                                del download_metadata[video_id]
                        except Exception as e:
                            logger.error(f"Error in similar cleanup: {e}")
                    
                    response = send_file(file_path, as_attachment=True, download_name=f)
                    cleanup_thread = threading.Thread(target=cleanup_similar)
                    cleanup_thread.daemon = True
                    cleanup_thread.start()
                    return response
    except Exception as e:
        logger.error(f"Error searching for similar files: {e}")
    
    logger.error(f"File not found: {filepath}")
    # List directory contents for debugging
    try:
        files = os.listdir(app.config['DOWNLOAD_FOLDER'])
        logger.error(f"Available files: {files}")
    except:
        pass
        
    return jsonify({'error': 'File not found'}), 404

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)