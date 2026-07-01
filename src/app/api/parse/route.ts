import { NextResponse } from 'next/server';
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';

export async function POST(request: Request) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      }
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch the URL' }, { status: response.status });
    }

    const html = await response.text();

    const doc = new JSDOM(html, { url });
    
    // Fix lazy loaded images before passing to Readability
    const images = doc.window.document.querySelectorAll('img');
    images.forEach(img => {
      // Many sites use data-* attributes for lazy loading
      const realSrc = img.getAttribute('data-src') || 
                      img.getAttribute('data-lazy-src') || 
                      img.getAttribute('data-original') ||
                      img.getAttribute('data-src-large') ||
                      img.getAttribute('data-image-src');
      
      if (realSrc && !img.getAttribute('src')) {
        img.setAttribute('src', realSrc);
      }
    });

    // Extract og:image from head for fallback
    const ogImageMeta = doc.window.document.querySelector('meta[property="og:image"]');
    const ogImage = ogImageMeta ? ogImageMeta.getAttribute('content') : null;

    const reader = new Readability(doc.window.document);
    const article = reader.parse();

    if (!article) {
      return NextResponse.json({ error: 'Could not parse article' }, { status: 500 });
    }
    
    let content = article.content;
    
    // If we have an og:image, prepend it to the content to ensure the article has a header image
    // especially useful for sites like Yahoo Finance that hide body images in JS state
    if (ogImage) {
      const headerImageHtml = `<img src="${ogImage}" alt="Article Header Image" style="width:100%; height:auto; border-radius:12px; margin-bottom: 24px;" />`;
      content = headerImageHtml + content;
    }

    return NextResponse.json({
      title: article.title,
      content: content,
      textContent: article.textContent,
      length: article.length,
      excerpt: article.excerpt,
      byline: article.byline,
      siteName: article.siteName,
      url: url,
      id: crypto.randomUUID(), // generate a unique ID for the article
      savedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error parsing article:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
