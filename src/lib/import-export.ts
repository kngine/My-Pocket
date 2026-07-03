import { fetchArticleFromUrl } from '@/lib/articles';
import {
  Article,
  Folder,
  clearAllData,
  getAllArticles,
  getFolders,
  saveArticle,
  saveFolder,
} from '@/lib/storage';

export const EXPORT_VERSION = 2;

export interface ExportFolder {
  id?: string;
  name: string;
  createdAt: string;
}

export interface ExportArticle {
  id?: string;
  url: string;
  title?: string;
  content?: string;
  textContent?: string;
  length?: number;
  excerpt?: string;
  byline?: string;
  siteName?: string;
  savedAt: string;
  folderId?: string;
  folderName?: string;
}

export interface MyPocketExport {
  version: 1 | typeof EXPORT_VERSION;
  exportedAt: string;
  folders: ExportFolder[];
  articles: ExportArticle[];
}

export interface ImportProgress {
  current: number;
  total: number;
  phase: 'folders' | 'articles' | 'done';
  message: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function hasStoredArticleContent(article: ExportArticle): article is Article & { folderName?: string } {
  return Boolean(
    article.id &&
      article.title &&
      typeof article.content === 'string' &&
      typeof article.textContent === 'string' &&
      typeof article.length === 'number'
  );
}

function abortIfNeeded(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException('Import cancelled', 'AbortError');
  }
}

export function parseExportFile(raw: unknown): MyPocketExport {
  if (!isRecord(raw)) {
    throw new Error('Invalid export file');
  }

  if (raw.version !== 1 && raw.version !== EXPORT_VERSION) {
    throw new Error('Unsupported export version');
  }

  if (!Array.isArray(raw.folders) || !Array.isArray(raw.articles)) {
    throw new Error('Invalid export file format');
  }

  const folders: ExportFolder[] = raw.folders.map((folder, index) => {
    if (!isRecord(folder) || typeof folder.name !== 'string' || !folder.name.trim()) {
      throw new Error(`Invalid folder at index ${index}`);
    }

    return {
      id: readOptionalString(folder.id),
      name: folder.name.trim(),
      createdAt: readString(folder.createdAt, new Date().toISOString()),
    };
  });

  const articles: ExportArticle[] = raw.articles.map((article, index) => {
    if (!isRecord(article) || typeof article.url !== 'string' || !article.url.trim()) {
      throw new Error(`Invalid article at index ${index}`);
    }

    return {
      id: readOptionalString(article.id),
      url: article.url.trim(),
      title: readOptionalString(article.title),
      content: typeof article.content === 'string' ? article.content : undefined,
      textContent: typeof article.textContent === 'string' ? article.textContent : undefined,
      length: typeof article.length === 'number' ? article.length : undefined,
      excerpt: readString(article.excerpt),
      byline: readString(article.byline),
      siteName: readString(article.siteName),
      savedAt: readString(article.savedAt, new Date().toISOString()),
      folderId: readOptionalString(article.folderId),
      folderName: readOptionalString(article.folderName),
    };
  });

  return {
    version: raw.version,
    exportedAt: readString(raw.exportedAt, new Date().toISOString()),
    folders,
    articles,
  };
}

export async function buildExport(): Promise<MyPocketExport> {
  const [articles, folders] = await Promise.all([getAllArticles(), getFolders()]);
  const folderById = new Map(folders.map((folder) => [folder.id, folder]));

  return {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    folders: folders.map((folder) => ({
      id: folder.id,
      name: folder.name,
      createdAt: folder.createdAt,
    })),
    articles: articles.map((article) => ({
      id: article.id,
      url: article.url,
      title: article.title,
      content: article.content,
      textContent: article.textContent,
      length: article.length,
      excerpt: article.excerpt,
      byline: article.byline,
      siteName: article.siteName,
      savedAt: article.savedAt,
      folderId: article.folderId,
      folderName: article.folderId ? folderById.get(article.folderId)?.name : undefined,
    })),
  };
}

export function downloadExport(data: MyPocketExport): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);

  anchor.href = url;
  anchor.download = `mypocket-export-${date}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function importLibrary(
  data: MyPocketExport,
  onProgress: (progress: ImportProgress) => void,
  signal?: AbortSignal
): Promise<{ imported: number; failed: string[] }> {
  try {
    await clearAllData();
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Unknown storage error';
    throw new Error(`Could not reset local library before import: ${reason}`);
  }

  const folderIdByOriginalId = new Map<string, string>();
  const folderIdByName = new Map<string, string>();
  const totalSteps = data.folders.length + data.articles.length;
  let current = 0;

  onProgress({
    current,
    total: totalSteps,
    phase: 'folders',
    message: 'Creating folders...',
  });

  for (const folder of data.folders) {
    abortIfNeeded(signal);

    const savedFolder: Folder = {
      id: folder.id || crypto.randomUUID(),
      name: folder.name,
      createdAt: folder.createdAt,
    };

    try {
      await saveFolder(savedFolder);
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown storage error';
      throw new Error(`Failed to save folder "${folder.name}": ${reason}`);
    }

    if (folder.id) folderIdByOriginalId.set(folder.id, savedFolder.id);
    folderIdByName.set(folder.name, savedFolder.id);
    current += 1;
    onProgress({
      current,
      total: totalSteps,
      phase: 'folders',
      message: `Created folder "${folder.name}"`,
    });
  }

  const failed: string[] = [];
  let imported = 0;

  for (const item of data.articles) {
    abortIfNeeded(signal);
    current += 1;
    onProgress({
      current,
      total: totalSteps,
      phase: 'articles',
      message: `Importing ${item.url}`,
    });

    const folderId = item.folderId
      ? folderIdByOriginalId.get(item.folderId) || item.folderId
      : item.folderName
        ? folderIdByName.get(item.folderName)
        : undefined;

    try {
      if (hasStoredArticleContent(item)) {
        await saveArticle({
          id: item.id,
          url: item.url,
          title: item.title,
          content: item.content,
          textContent: item.textContent,
          length: item.length,
          excerpt: item.excerpt || '',
          byline: item.byline || '',
          siteName: item.siteName || '',
          savedAt: item.savedAt,
          folderId,
        });
      } else {
        const parsed = await fetchArticleFromUrl(item.url, signal);
        await saveArticle({
          ...parsed,
          savedAt: item.savedAt,
          folderId,
        });
      }
      imported += 1;
    } catch {
      failed.push(item.url);
    }
  }

  onProgress({
    current: totalSteps,
    total: totalSteps,
    phase: 'done',
    message: failed.length
      ? `Imported ${imported} articles. ${failed.length} failed.`
      : `Imported ${imported} articles.`,
  });

  return { imported, failed };
}
