import client from '../api/client';
import { ENDPOINTS } from '../api/endpoints';
import { TaskHistory, UserRole } from '../types';

export const taskService = {
    /**
     * Fetch complete activity and changes history for a task node
     * @param taskId Unique identifier of the task node
     */
    getTaskHistory: async (taskId: string): Promise<TaskHistory[]> => {
        try {
            const response = await client.get(ENDPOINTS.TASKS.history(taskId));
            const data = response.data || [];
            
            // Map the REST API payload to our types-compliant TaskHistory interface
            return data.map((item: any) => ({
                id: item.id,
                changeDescription: item.changeDescription,
                createdAt: item.createdAt,
                user: {
                    id: item.userId,
                    name: item.userName || 'System',
                    avatarUrl: item.userAvatarUrl || '',
                    role: UserRole.MEMBER
                }
            }));
        } catch (error) {
            console.error(`[taskService] Failed to load history for task ${taskId}:`, error);
            return [];
        }
    }
};
