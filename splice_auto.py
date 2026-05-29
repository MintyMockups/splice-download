import asyncio
import sys
import re
import json
from pathlib import Path

try:
    from playwright.async_api import async_playwright
except ImportError:
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "playwright"])
    subprocess.check_call([sys.executable, "-m", "playwright", "install", "chromium"])
    from playwright.async_api import async_playwright

async def automate_splice_download(sample_url, output_filename=None):
    print("NIXO Splice Auto Extractor")
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(user_agent='Mozilla/5.0')
        page = await context.new_page()
        
        await page.goto(sample_url, wait_until="networkidle")
        await asyncio.sleep(4)
        
        audio_url = None
        
        def handle_request(request):
            nonlocal audio_url
            url = request.url
            if any(ext in url.lower() for ext in ['.wav', '.mp3', '.flac', '.aiff']) and ('splice' in url or 'amazonaws' in url):
                if any(k in url.lower() for k in ['token', 'signature', 'expires', 'policy']):
                    audio_url = url
                    print(f"Captured: {url[:120]}...")
        
        page.on("request", handle_request)
        
        # Trigger play
        try:
            await page.click('button[aria-label*="play"]', timeout=3000)
        except:
            await page.evaluate("""() => {
                document.querySelectorAll('button').forEach(b => {
                    if (b.textContent.toLowerCase().includes('play')) b.click();
                });
            }""")
        
        await asyncio.sleep(8)
        
        if not audio_url:
            content = await page.content()
            matches = re.findall(r'https?://[^"\']+\.(wav|mp3)[^"\']*', content)
            for m in matches:
                if 'token' in m or 'signature' in m:
                    audio_url = m
                    break
        
        await browser.close()
        
        if audio_url:
            filename = output_filename or f"splice_sample_{int(asyncio.get_event_loop().time())}.wav"
            await download_audio(audio_url, filename)
        else:
            print("Failed to capture URL")

async def download_audio(url, filename):
    import requests
    r = requests.get(url, stream=True)
    with open(filename, 'wb') as f:
        for chunk in r.iter_content(8192):
            f.write(chunk)
    print(f"Downloaded: {filename}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python splice_auto.py <url>")
        sys.exit(1)
    asyncio.run(automate_splice_download(sys.argv[1], sys.argv[2] if len(sys.argv)>2 else None))
