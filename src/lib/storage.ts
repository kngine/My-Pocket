import localforage from 'localforage';

export interface Article {
  id: string;
  url: string;
  title: string;
  content: string; // HTML content
  textContent: string;
  length: number;
  excerpt: string;
  byline: string;
  siteName: string;
  savedAt: string; // ISO Date string
  folderId?: string; // Optional folder assignment
}

export interface Folder {
  id: string;
  name: string;
  createdAt: string;
}

// Initialize localforage store for articles
const articlesStore = localforage.createInstance({
  name: 'pocket-clone',
  storeName: 'articles',
  description: 'Saved articles for offline reading'
});

const foldersStore = localforage.createInstance({
  name: 'pocket-clone',
  storeName: 'folders',
  description: 'Folders to group articles'
});

export const saveArticle = async (article: Article): Promise<void> => {
  await articlesStore.setItem(article.id, article);
};

export const updateArticle = async (article: Article): Promise<void> => {
  await articlesStore.setItem(article.id, article);
};

export const getArticle = async (id: string): Promise<Article | null> => {
  return await articlesStore.getItem<Article>(id);
};

export const deleteArticle = async (id: string): Promise<void> => {
  await articlesStore.removeItem(id);
};

export const getAllArticles = async (): Promise<Article[]> => {
  const articles: Article[] = [];
  await articlesStore.iterate<Article, void>((value, key, iterationNumber) => {
    articles.push(value);
  });
  // Sort by savedAt descending (newest first)
  return articles.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
};

export const createFolder = async (name: string): Promise<Folder> => {
  const folder: Folder = {
    id: crypto.randomUUID(),
    name,
    createdAt: new Date().toISOString()
  };
  await foldersStore.setItem(folder.id, folder);
  return folder;
};

export const getFolders = async (): Promise<Folder[]> => {
  const folders: Folder[] = [];
  await foldersStore.iterate<Folder, void>((value, key, iterationNumber) => {
    folders.push(value);
  });
  return folders.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
};

export const getFolder = async (id: string): Promise<Folder | null> => {
  return await foldersStore.getItem<Folder>(id);
};

export const deleteFolder = async (id: string): Promise<void> => {
  await foldersStore.removeItem(id);
  // Optional: Also remove folderId from articles in this folder
  const articles = await getAllArticles();
  for (const article of articles) {
    if (article.folderId === id) {
      article.folderId = undefined;
      await updateArticle(article);
    }
  }
};
