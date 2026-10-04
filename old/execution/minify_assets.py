import os
import shutil
import argparse
import subprocess
import re
from pathlib import Path
from datetime import datetime

# Configuration
BASE_URL = "https://smpg.app/"
DEST_DIR = Path("live")
IGNORE_DIRS = {'.git', '.gemini', '.tmp', 'live', 'execution', 'directives', 'node_modules', '__pycache__', '.vscode', '.idea'}
IGNORE_FILES = {'AGENTS.md', 'task.md', 'smpg_polish.py', 'package.json', 'package-lock.json', 'README.md', '.gitignore', '.DS_Store'}
ALLOWED_EXTENSIONS = {'.html', '.css', '.js', '.svg', '.png', '.jpg', '.jpeg', '.webp', '.json', '.xml', '.txt', '.ico'}

def parse_arguments():
    parser = argparse.ArgumentParser(description="Minify and deploy assets to live/ directory.")
    parser.add_argument('--source', type=Path, default=Path("."), help="Source directory")
    return parser.parse_args()

def run_command(command):
    try:
        subprocess.run(command, check=True, shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return True
    except subprocess.CalledProcessError:
        return False

def clean_dest():
    if DEST_DIR.exists():
        print(f"Cleaning {DEST_DIR}...")
        shutil.rmtree(DEST_DIR)
    DEST_DIR.mkdir(parents=True)

def copy_assets(source):
    print(f"Copying assets from {source} to {DEST_DIR}...")
    count = 0
    for root, dirs, files in os.walk(source):
        # Filter directories in-place
        dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]
        
        rel_path = Path(root).relative_to(source)
        dest_path = DEST_DIR / rel_path
        
        if not dest_path.exists():
            dest_path.mkdir(parents=True)
            
        for file in files:
            if file in IGNORE_FILES:
                continue
            
            file_path = Path(root) / file
            if file_path.suffix.lower() not in ALLOWED_EXTENSIONS and file != 'CNAME': # Added CNAME just in case
                continue
                
            shutil.copy2(file_path, dest_path / file)
            count += 1
            
    print(f"  Copied {count} files.")

def optimize_images():
    print("Optimization: Images...")
    count = 0
    for file_path in DEST_DIR.glob("**/*"):
        if file_path.suffix.lower() in ['.png', '.jpg', '.jpeg']:
            webp_path = file_path.with_suffix('.webp')
            
            # Check if webp already exists (copied from source)
            if webp_path.exists():
                if webp_path.stat().st_mtime > file_path.stat().st_mtime:
                    continue
            
            print(f"  Converting {file_path.name}...")
            # FFmpeg conversion
            cmd = f'ffmpeg -y -i "{file_path}" -compression_level 6 -q:v 75 "{webp_path}"'
            if run_command(cmd):
                count += 1
                
    print(f"  Converted {count} images to WebP.")

def minify_content(content, ext):
    if ext == '.html':
        content = re.sub(r'<!--(?!\[if).*?-->', '', content, flags=re.DOTALL)
        content = re.sub(r'>\s+<', '><', content)
        content = re.sub(r'\s+', ' ', content)
        return content
    elif ext == '.css':
        content = re.sub(r'/\*.*?\*/', '', content, flags=re.DOTALL)
        content = re.sub(r'\s+', ' ', content)
        content = re.sub(r'\s?([{:;}])\s?', r'\1', content)
        return content
    elif ext == '.js':
        content = re.sub(r'//.*', '', content)
        content = re.sub(r'/\*.*?\*/', '', content, flags=re.DOTALL)
        lines = [line.strip() for line in content.splitlines() if line.strip()]
        return '\n'.join(lines)
    return content

def minify_assets():
    print("Optimization: Minifying Assets...")
    extensions = ['.html', '.css', '.js']
    count = 0
    
    for file_path in DEST_DIR.glob("**/*"):
        if file_path.suffix.lower() in extensions and file_path.is_file():
            if '.min.' in file_path.name:
                continue
                
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                minified = minify_content(content, file_path.suffix.lower())
                
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(minified)
                count += 1
            except Exception as e:
                print(f"  Error minifying {file_path.name}: {e}")

    print(f"  Minified {count} files.")

def generate_sitemap_robots():
    print("SEO: Generating robots.txt...")
    robots_content = f"User-agent: *\nAllow: /\n\nSitemap: {BASE_URL}sitemap.xml"
    with open(DEST_DIR / "robots.txt", "w", encoding='utf-8') as f:
        f.write(robots_content)
    print("  Generated robots.txt in live/")

if __name__ == "__main__":
    args = parse_arguments()
    print("Starting Deployment Workflow...")
    
    clean_dest()
    copy_assets(args.source)
    optimize_images()
    minify_assets()
    generate_sitemap_robots()
    
    print("Deployment Workflow Complete. Assets ready in live/.")
