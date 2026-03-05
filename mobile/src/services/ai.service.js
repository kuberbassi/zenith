import api from './api';

const aiService = {
    chat: async (payload) => {
        try {
            // Note: The backend route is /api/ai/chat
            // If payload is a string, wrap it. If it's an object, spread it.
            const body = typeof payload === 'string' ? { message: payload } : payload;
            const response = await api.post('/api/ai/chat', body);
            return response.data;
        } catch (error) {
            console.error('AI Chat Error:', error);
            throw error;
        }
    }
};

export default aiService;
