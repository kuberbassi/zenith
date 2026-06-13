import api from './api';

export interface Bookmark {
    id: string;
    user_id: string;
    url: string;
    title: string;
    cleaned_title?: string;
    category: string;
    tags: string[];
    priority: number;
    is_duplicate: boolean;
    clicked_at?: string;
    click_count: number;
    ai_processed: boolean;
    created_at: string;
    updated_at: string;
}

export const bookmarksService = {
    getBookmarks: async (params?: {
        category?: string;
        search?: string;
        is_duplicate?: boolean;
        sort?: string;
        order?: string;
    }): Promise<Bookmark[]> => {
    const response = await api.get('/api/bookmarks', { params });
        return response.data.data;
    },

    addBookmark: async (url: string, title?: string, category?: string): Promise<Bookmark> => {
        const response = await api.post('/api/bookmarks', { url, title, category });
        return response.data.data;
    },

    importBookmarks: async (content: string, type: 'html' | 'json'): Promise<{ importedCount: number }> => {
        const response = await api.post('/api/bookmarks/import', { content, type });
        return response.data.data;
    },

    aiEnrich: async (ids: string[]): Promise<{ bookmarks: Bookmark[] }> => {
        const response = await api.post('/api/bookmarks/ai-enrich', { ids });
        return response.data.data;
    },

    updateBookmark: async (id: string, data: Partial<Omit<Bookmark, 'id' | 'user_id'>>): Promise<Bookmark> => {
        const response = await api.put(`/api/bookmarks/${id}`, data);
        return response.data.data;
    },

    recordClick: async (id: string): Promise<Bookmark> => {
        const response = await api.post(`/api/bookmarks/${id}/click`);
        return response.data.data;
    },

    deleteBookmark: async (id: string): Promise<void> => {
        await api.delete(`/api/bookmarks/${id}`);
    },

    batchDeleteBookmarks: async (ids: string[]): Promise<{ count: number }> => {
        const response = await api.post('/api/bookmarks/batch-delete', { ids });
        return response.data.data;
    },

    renameCategory: async (oldCategoryName: string, newCategoryName: string): Promise<{ count: number }> => {
        const response = await api.post('/api/bookmarks/rename-category', { oldCategoryName, newCategoryName });
        return response.data.data;
    },
};
