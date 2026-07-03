'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { 
  getAllArticles, Article, deleteArticle, updateArticle,
  getFolder, Folder, getFolders
} from '@/lib/storage';
import { getSiteLabel } from '@/lib/url';
import homeStyles from '@/app/page.module.css';
import styles from './page.module.css';

export default function FolderPage() {
  const { id } = useParams();
  const folderId = typeof id === 'string' ? id : '';
  const router = useRouter();

  const [folder, setFolder] = useState<Folder | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [allFolders, setAllFolders] = useState<Folder[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    const [foundFolder, allArticles, savedFolders] = await Promise.all([
      getFolder(folderId),
      getAllArticles(),
      getFolders()
    ]);
    setFolder(foundFolder);
    setArticles(allArticles.filter(a => a.folderId === folderId));
    setAllFolders(savedFolders);
    setIsLoading(false);
  }, [folderId]);

  useEffect(() => {
    if (folderId) {
      // localforage is the external client-side source of truth for folders.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadData();
    }
  }, [folderId, loadData]);

  const handleDeleteArticle = async (e: React.MouseEvent, articleId: string) => {
    e.stopPropagation();
    await deleteArticle(articleId);
    loadData();
  };

  const handleMoveToFolder = async (e: React.ChangeEvent<HTMLSelectElement>, article: Article) => {
    e.stopPropagation();
    const newFolderId = e.target.value;
    await updateArticle({ ...article, folderId: newFolderId || undefined });
    loadData();
  };

  if (isLoading) {
    return (
      <div className="container" style={{ display: 'flex', justifyContent: 'center', marginTop: '100px' }}>
        <div className="spinner" style={{ borderTopColor: 'var(--accent-purple)' }}></div>
      </div>
    );
  }

  if (!folder) {
    return (
      <div className="container">
        <h2>Folder not found</h2>
        <button onClick={() => router.push('/')}>Go back home</button>
      </div>
    );
  }

  return (
    <div className="container">
      <header className={styles.header}>
        <button className={styles.backButton} onClick={() => router.push('/')}>Back</button>
        <div>
          <p className={homeStyles.sectionKicker}>Folder</p>
          <h1 className={homeStyles.title}>{folder.name}</h1>
        </div>
      </header>

      <div className={homeStyles.grid}>
        {articles.map((article) => (
          <div 
            key={article.id} 
            className={`${homeStyles.card} glass-panel`}
            onClick={() => router.push(`/reader/${article.id}`)}
          >
            <div className={homeStyles.cardContent}>
              <h2 className={homeStyles.cardTitle}>{article.title}</h2>
              <p className={homeStyles.cardExcerpt}>{article.excerpt}</p>
              <div className={homeStyles.cardMeta}>
                <span className={homeStyles.siteName}>{getSiteLabel(article.url, article.siteName)}</span>
                <span className={homeStyles.date}>{new Date(article.savedAt).toLocaleDateString()}</span>
              </div>
            </div>
            
            <div className={homeStyles.cardActions} onClick={e => e.stopPropagation()}>
              <select 
                className={homeStyles.folderSelect}
                value={folderId}
                onChange={(e) => handleMoveToFolder(e, article)}
              >
                <option value="">(Remove from folder)</option>
                {allFolders.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
              <button 
                className={homeStyles.deleteButtonAlt} 
                onClick={(e) => handleDeleteArticle(e, article.id)}
                aria-label="Delete article"
              >✕</button>
            </div>
          </div>
        ))}
        
        {articles.length === 0 && (
          <div className={homeStyles.emptyState}>
            <p>This folder is empty. Go back home to move articles here.</p>
          </div>
        )}
      </div>
    </div>
  );
}
