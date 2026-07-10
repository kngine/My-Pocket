'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { 
  saveArticle, getAllArticles, Article, deleteArticle, updateArticle,
  createFolder, getFolders, Folder, deleteFolder 
} from '@/lib/storage';
import { fetchArticleFromUrl } from '@/lib/articles';
import {
  buildExport,
  downloadExport,
  importLibrary,
  parseExportFile,
  ImportProgress,
} from '@/lib/import-export';
import { normalizeUrl, getSiteLabel } from '@/lib/url';
import styles from './page.module.css';

export default function Home() {
  const [url, setUrl] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [appliedSearchQuery, setAppliedSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [articles, setArticles] = useState<Article[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [statusMessage, setStatusMessage] = useState('');

  const importInputRef = useRef<HTMLInputElement>(null);
  const importAbortRef = useRef<AbortController | null>(null);

  const router = useRouter();
  const isBusy = isLoading || importProgress?.phase === 'folders' || importProgress?.phase === 'articles';
  const normalizedSearchQuery = appliedSearchQuery.trim().toLowerCase();
  const visibleArticles = useMemo(() => {
    if (!normalizedSearchQuery) return articles;

    return articles.filter((article) => {
      const searchableText = [
        article.title,
        article.excerpt,
        article.byline,
        article.siteName,
        article.url,
        article.textContent,
      ].join(' ').toLowerCase();

      return searchableText.includes(normalizedSearchQuery);
    });
  }, [articles, normalizedSearchQuery]);

  const loadData = useCallback(async () => {
    const [savedArticles, savedFolders] = await Promise.all([
      getAllArticles(),
      getFolders()
    ]);
    // On the home page, we only show articles that are NOT in a folder (or we could show all). Let's show only un-foldered articles on Home.
    setArticles(savedArticles.filter(a => !a.folderId));
    setFolders(savedFolders);
  }, []);

  useEffect(() => {
    // localforage is the external client-side source of truth for the library.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, [loadData]);

  const handleSaveArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setIsLoading(true);
    setError('');

    let normalizedUrl: string;
    try {
      normalizedUrl = normalizeUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Please enter a valid URL');
      setIsLoading(false);
      return;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);
      const article = await fetchArticleFromUrl(normalizedUrl, controller.signal);

      clearTimeout(timeoutId);
      await saveArticle(article);
      setUrl('');
      loadData();
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        setError('Request timed out. Check your connection and try again.');
      } else if (err instanceof Error) {
        setError(err.message || 'An error occurred');
      } else {
        setError('An error occurred');
      }
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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setAppliedSearchQuery(searchQuery.trim());
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setAppliedSearchQuery('');
  };

  const handleExport = async () => {
    setError('');
    setStatusMessage('');

    try {
      const data = await buildExport();
      downloadExport(data);
      setStatusMessage(`Exported ${data.articles.length} articles with full offline content.`);
    } catch {
      setError('Export failed. Please try again.');
    }
  };

  const handleImportClick = () => {
    importInputRef.current?.click();
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';

    if (!file) return;

    setError('');
    setStatusMessage('');

    let exportData;
    try {
      const text = await file.text();
      exportData = parseExportFile(JSON.parse(text));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid import file');
      return;
    }

    const confirmed = window.confirm(
      `Import ${exportData.articles.length} articles and ${exportData.folders.length} folders? This replaces your current library.`
    );
    if (!confirmed) return;

    const controller = new AbortController();
    importAbortRef.current = controller;
    setImportProgress({
      current: 0,
      total: exportData.folders.length + exportData.articles.length,
      phase: 'folders',
      message: 'Starting import...',
    });

    try {
      const result = await importLibrary(exportData, setImportProgress, controller.signal);
      await loadData();
      setStatusMessage(
        result.failed.length
          ? `Imported ${result.imported} articles. ${result.failed.length} could not be imported.`
          : `Imported ${result.imported} articles.`
      );
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setError('Import cancelled.');
      } else if (err instanceof Error) {
        console.error('Import failed:', err);
        setError(err.message || 'Import failed. Please try again.');
      } else {
        console.error('Import failed:', err);
        setError('Import failed. Please try again.');
      }
    } finally {
      importAbortRef.current = null;
      setImportProgress(null);
    }
  };

  return (
    <div className={`container ${styles.appShell}`}>
      <header className={styles.header}>
        <h1 className={styles.title}>MyPocket</h1>
        <p className={styles.subtitle}>Save articles for offline reading</p>
      </header>

      <main className={styles.mainContent}>
        <form onSubmit={handleSaveArticle} className={styles.form}>
          <label className={styles.inputWrap}>
            <span className={styles.inputLabel}>Add article</span>
            <input
              type="text"
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste URL here"
              className={styles.input}
              required
            />
          </label>
          <button type="submit" className={styles.button} disabled={isBusy}>
            {isLoading ? <div className="spinner" /> : 'Save'}
          </button>
        </form>

        {error && <div className={styles.error}>{error}</div>}
        {statusMessage && !error && <div className={styles.status}>{statusMessage}</div>}
        {importProgress && (
          <div className={styles.importProgress}>
            {importProgress.message} ({importProgress.current}/{importProgress.total})
          </div>
        )}

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.sectionKicker}>{normalizedSearchQuery ? 'Search Results' : 'Recently Added'}</p>
              <h2 className={styles.sectionTitle}>Articles</h2>
            </div>
          </div>

          <div className={styles.grid}>
            {visibleArticles.map((article) => (
              <div
                key={article.id}
                className={styles.card}
                onClick={() => router.push(`/reader/${article.id}`)}
              >
                <div className={styles.cardContent}>
                  <h2 className={styles.cardTitle}>{article.title}</h2>
                  <p className={styles.cardExcerpt}>{article.excerpt}</p>
                  <div className={styles.cardMeta}>
                    <span className={styles.siteName}>{getSiteLabel(article.url, article.siteName)}</span>
                    <span className={styles.date}>{new Date(article.savedAt).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className={styles.cardActions} onClick={e => e.stopPropagation()}>
                  <select
                    className={styles.folderSelect}
                    value=""
                    onChange={(e) => handleMoveToFolder(e, article)}
                  >
                    <option value="" disabled>Move</option>
                    {folders.map(f => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                  <button
                    className={styles.deleteButtonAlt}
                    onClick={(e) => handleDeleteArticle(e, article.id)}
                    aria-label="Delete article"
                  >x</button>
                </div>
              </div>
            ))}

            {articles.length === 0 && !isLoading && (
              <div className={styles.emptyState}>
                <p>No unorganized articles yet.</p>
                <small>Paste a link above to build your offline library.</small>
              </div>
            )}
            {articles.length > 0 && visibleArticles.length === 0 && (
              <div className={styles.emptyState}>
                <p>No matching articles.</p>
                <small>Try searching by title, site, author, or URL.</small>
              </div>
            )}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.sectionKicker}>Browse</p>
              <h2 className={styles.sectionTitle}>Folders</h2>
            </div>
            {!isCreatingFolder ? (
              <button className={styles.textButton} onClick={() => setIsCreatingFolder(true)}>New</button>
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
                className={styles.folderCard}
                onClick={() => router.push(`/folder/${folder.id}`)}
              >
                <h3 className={styles.folderName}>{folder.name}</h3>
                <button
                  className={styles.deleteButton}
                  onClick={(e) => handleDeleteFolder(e, folder.id)}
                  aria-label="Delete folder"
                >x</button>
              </div>
            ))}
            {folders.length === 0 && (
              <div className={styles.emptyShelf}>
                Create folders to keep your reading list organized.
              </div>
            )}
          </div>
        </section>

        <footer className={styles.pageFooter} aria-label="Search and data actions">
          <form className={styles.searchPanel} onSubmit={handleSearch}>
            <div className={styles.searchGlow} aria-hidden="true" />
            <div className={styles.searchWrap}>
              <button type="submit" className={styles.searchButton}>
                Search
              </button>
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search your library"
                className={styles.searchInput}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
              {searchQuery && (
                <button
                  type="button"
                  className={styles.clearSearchButton}
                  onClick={handleClearSearch}
                  aria-label="Clear search"
                >
                  x
                </button>
              )}
            </div>
          </form>

          <div className={styles.dataActions}>
            <button
              type="button"
              className={styles.subtleButton}
              onClick={handleExport}
              disabled={isBusy}
            >
              Export
            </button>
            <span className={styles.dataDivider}>/</span>
            <button
              type="button"
              className={styles.subtleButton}
              onClick={handleImportClick}
              disabled={isBusy}
            >
              Import
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept="application/json,.json"
              className={styles.hiddenInput}
              onChange={handleImportFile}
            />
          </div>
        </footer>
      </main>
    </div>
  );
}
