'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  saveArticle, getAllArticles, Article, deleteArticle, updateArticle,
  createFolder, getFolders, Folder, deleteFolder 
} from '@/lib/storage';
import styles from './page.module.css';

export default function Home() {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [articles, setArticles] = useState<Article[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);

  const router = useRouter();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [savedArticles, savedFolders] = await Promise.all([
      getAllArticles(),
      getFolders()
    ]);
    // On the home page, we only show articles that are NOT in a folder (or we could show all). Let's show only un-foldered articles on Home.
    setArticles(savedArticles.filter(a => !a.folderId));
    setFolders(savedFolders);
  };

  const handleSaveArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;

    setIsLoading(true);
    setError('');

    try {
      const res = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });

      if (!res.ok) {
        throw new Error('Failed to parse the URL');
      }

      const article: Article = await res.json();
      await saveArticle(article);
      setUrl('');
      loadData();
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    await createFolder(newFolderName.trim());
    setNewFolderName('');
    setIsCreatingFolder(false);
    loadData();
  };

  const handleDeleteArticle = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await deleteArticle(id);
    loadData();
  };

  const handleMoveToFolder = async (e: React.ChangeEvent<HTMLSelectElement>, article: Article) => {
    e.stopPropagation();
    const folderId = e.target.value;
    // If folderId is empty, it moves it to home (removes folderId)
    await updateArticle({ ...article, folderId: folderId || undefined });
    loadData();
  };

  const handleDeleteFolder = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await deleteFolder(id);
    loadData();
  };

  return (
    <div className="container">
      <header className={styles.header}>
        <img src="/icon.svg" alt="MyPocket Logo" className={styles.logo} />
        <h1 className={`${styles.title} text-gradient`}>MyPocket</h1>
        <p className={styles.subtitle}>Save articles for offline reading</p>
      </header>

      <form onSubmit={handleSaveArticle} className={`${styles.form} glass-panel`}>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste URL here..."
          className={styles.input}
          required
        />
        <button type="submit" className={styles.button} disabled={isLoading}>
          {isLoading ? <div className="spinner" /> : 'Save'}
        </button>
      </form>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Folders</h2>
        {!isCreatingFolder ? (
          <button className={styles.textButton} onClick={() => setIsCreatingFolder(true)}>+ New Folder</button>
        ) : (
          <form onSubmit={handleCreateFolder} className={styles.folderForm}>
            <input 
              autoFocus
              type="text" 
              placeholder="Folder name" 
              className={styles.folderInput}
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
            />
            <button type="submit" className={styles.smallButton}>Create</button>
            <button type="button" className={styles.cancelButton} onClick={() => setIsCreatingFolder(false)}>Cancel</button>
          </form>
        )}
      </div>

      <div className={styles.folderGrid}>
        {folders.map(folder => (
          <div 
            key={folder.id} 
            className={`${styles.folderCard} glass-panel`}
            onClick={() => router.push(`/folder/${folder.id}`)}
          >
            <div className={styles.folderIcon}>📁</div>
            <h3 className={styles.folderName}>{folder.name}</h3>
            <button 
              className={styles.deleteButton} 
              onClick={(e) => handleDeleteFolder(e, folder.id)}
              aria-label="Delete folder"
            >✕</button>
          </div>
        ))}
      </div>

      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Unorganized Articles</h2>
      </div>

      <div className={styles.grid}>
        {articles.map((article) => (
          <div 
            key={article.id} 
            className={`${styles.card} glass-panel`}
            onClick={() => router.push(`/reader/${article.id}`)}
          >
            <div className={styles.cardContent}>
              <h2 className={styles.cardTitle}>{article.title}</h2>
              <p className={styles.cardExcerpt}>{article.excerpt}</p>
              <div className={styles.cardMeta}>
                <span className={styles.siteName}>{article.siteName || new URL(article.url).hostname}</span>
                <span className={styles.date}>{new Date(article.savedAt).toLocaleDateString()}</span>
              </div>
            </div>
            
            <div className={styles.cardActions} onClick={e => e.stopPropagation()}>
              <select 
                className={styles.folderSelect}
                value=""
                onChange={(e) => handleMoveToFolder(e, article)}
              >
                <option value="" disabled>Move to...</option>
                {folders.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
              <button 
                className={styles.deleteButtonAlt} 
                onClick={(e) => handleDeleteArticle(e, article.id)}
                aria-label="Delete article"
              >✕</button>
            </div>
          </div>
        ))}
        
        {articles.length === 0 && !isLoading && (
          <div className={styles.emptyState}>
            <p>No unorganized articles. Paste a link above to get started!</p>
          </div>
        )}
      </div>
    </div>
  );
}
