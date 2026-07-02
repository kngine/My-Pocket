'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import DOMPurify from 'dompurify';
import { getArticle, Article } from '@/lib/storage';
import { getSiteLabel } from '@/lib/url';
import styles from './page.module.css';

export default function Reader() {
  const { id } = useParams();
  const router = useRouter();
  const [article, setArticle] = useState<Article | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fontSize, setFontSize] = useState('medium'); // small, medium, large

  useEffect(() => {
    const loadArticle = async () => {
      if (typeof id === 'string') {
        const found = await getArticle(id);
        setArticle(found);
      }
      setIsLoading(false);
    };
    loadArticle();
  }, [id]);

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className="spinner" style={{ borderColor: 'rgba(0,0,0,0.1)', borderTopColor: 'var(--accent-color)' }} />
      </div>
    );
  }

  if (!article) {
    return (
      <div className={styles.errorContainer}>
        <h2>Article not found</h2>
        <button className={styles.backButton} onClick={() => router.push('/')}>Go back home</button>
      </div>
    );
  }

  const sanitizedContent = DOMPurify.sanitize(article.content);

  return (
    <div className={`container ${styles.readerContainer}`}>
      <nav className={`${styles.nav} glass-panel`}>
        <button className={styles.navButton} onClick={() => router.push('/')}>
          ← Back
        </button>
        <div className={styles.controls}>
          <button 
            className={`${styles.navButton} ${fontSize === 'small' ? styles.active : ''}`}
            onClick={() => setFontSize('small')}
            title="Small text"
          >A</button>
          <button 
            className={`${styles.navButton} ${fontSize === 'medium' ? styles.active : ''}`}
            onClick={() => setFontSize('medium')}
            title="Medium text"
          >A</button>
          <button 
            className={`${styles.navButton} ${fontSize === 'large' ? styles.active : ''}`}
            onClick={() => setFontSize('large')}
            title="Large text"
            style={{ fontSize: '1.2rem' }}
          >A</button>
        </div>
      </nav>

      <article className={`${styles.article} ${styles[fontSize]}`}>
        <header className={styles.articleHeader}>
          <h1 className={styles.title}>{article.title}</h1>
          <div className={styles.meta}>
            {article.byline && <span className={styles.byline}>{article.byline}</span>}
            <span className={styles.siteName}>{getSiteLabel(article.url, article.siteName)}</span>
          </div>
        </header>

        <div 
          className={styles.content}
          dangerouslySetInnerHTML={{ __html: sanitizedContent }}
        />
        
        <div className={styles.footer}>
          <a href={article.url} target="_blank" rel="noopener noreferrer" className={styles.originalLink}>
            View original article
          </a>
        </div>
      </article>
    </div>
  );
}
