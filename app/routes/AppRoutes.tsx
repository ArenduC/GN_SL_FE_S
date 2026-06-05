import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import App from '../../App';

export const AppRoutes: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Core app routes */}
        <Route path="/" element={<App view="dashboard" />} />
        <Route path="/dashboard" element={<App view="dashboard" />} />
        <Route path="/tasks" element={<App view="tasks" />} />
        <Route path="/resources" element={<App view="resources" />} />
        {/* Project details direct route */}
        <Route path="/project/:projectId" element={<App view="project" />} />
        {/* Project specific create task page */}
        <Route path="/project/:projectId/create-task" element={<App view="create-task" />} />
        {/* Project specific task details full page */}
        <Route path="/project/:projectId/task/:taskId" element={<App view="task-details" />} />
        {/* Fallback to home */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
};
