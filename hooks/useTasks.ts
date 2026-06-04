import { useState, useCallback } from 'react';
import { taskService } from '../services/task.service';
import { TaskHistory } from '../types';

export const useTasks = () => {
    const [history, setHistory] = useState<TaskHistory[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadTaskHistory = useCallback(async (taskId: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await taskService.getTaskHistory(taskId);
            setHistory(data);
            return data;
        } catch (err: any) {
            setError(err.message || 'Failed to fetch task history');
            return [];
        } finally {
            setIsLoading(false);
        }
    }, []);

    return {
        history,
        isLoading,
        error,
        loadTaskHistory,
    };
};
