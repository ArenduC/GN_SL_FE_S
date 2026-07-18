import { Project, User, AugmentedTask } from '../types';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// Helper to escape CSV fields
const escapeCsvField = (field: string | undefined | null): string => {
  if (field === null || field === undefined) {
    return '""';
  }
  const stringField = String(field);
  // If the field contains a comma, double quote, or newline, wrap it in double quotes
  if (/[",\n]/.test(stringField)) {
    // Also, double up any existing double quotes
    return `"${stringField.replace(/"/g, '""')}"`;
  }
  return `"${stringField}"`;
};

export const exportTasksToCsv = (projects: Project[], users: Record<string, User>) => {
  const headers = [
    'Ticket ID', 'Type', 'Project ID', 'Project Name', 'Task ID', 'Task Title', 'Task Description',
    'Status', 'Priority', 'Assignee Name', 'Creator Name', 'Created At', 'Original ID (UUID)'
  ];

  const rows = projects.flatMap(project => {
    const tasks = Object.values(project?.board?.tasks || {});
    return tasks.flatMap(task => {
      const column = Object.values(project?.board?.columns || {}).find(c => c.taskIds.includes(task.id));
      const creator = users[task.creatorId];
      const assignee = task.assignee ? users[task.assignee.id] : null;

      const taskRow = [
        task.ticketId || '',
        'Task',
        project.id,
        project.name,
        task.id,
        task.title,
        task.description,
        column?.title || 'Uncategorized',
        task.priority,
        assignee?.name || 'Unassigned',
        creator?.name || 'Unknown',
        task.createdAt,
        task.id
      ].map(escapeCsvField).join(',');

      const subtaskRows = (task.subtasks || []).map(st => {
        const stAssignee = st.assigneeId ? users[st.assigneeId] : null;
        return [
          st.ticketId || '',
          'Subtask',
          project.id,
          project.name,
          st.id,
          st.title,
          '', // No description for subtasks in export usually
          column?.title || 'Uncategorized',
          task.priority, // Inherit priority
          stAssignee?.name || 'Unassigned',
          creator?.name || 'Unknown',
          st.createdAt,
          st.id
        ].map(escapeCsvField).join(',');
      });

      return [taskRow, ...subtaskRows];
    });
  });

  const csvContent = [headers.join(','), ...rows].join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    const timestamp = new Date().toISOString().slice(0, 10);
    const projectName = projects.length === 1 ? projects[0].name.replace(/\s+/g, '_').toLowerCase() : 'multi_project';
    link.setAttribute('href', url);
    link.setAttribute('download', `tasks_export_${projectName}_${timestamp}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

export const exportAugmentedTasksToCsv = (tasks: AugmentedTask[], users: Record<string, User>, projectName: string = 'tasks') => {
  const headers = [
    'ID', 'Type', 'Title', 'Project', 'Status', 'Priority', 
    'Assignee', 'Creator', 'Created At', 'Original ID (UUID)', 'Description'
  ];

  const rows = tasks.flatMap(task => {
      const creator = users[task.creatorId];
      const assignee = task.assignee ? users[task.assignee.id] : null;

      const taskRow = [
        task.ticketId || '',
        'Task',
        task.title,
        task.projectName,
        task.columnName,
        task.priority,
        assignee?.name || 'Unassigned',
        creator?.name || 'Unknown',
        task.createdAt,
        task.id,
        task.description
      ].map(escapeCsvField).join(',');

      const subtaskRows = (task.subtasks || []).map(st => {
        const stAssignee = st.assigneeId ? users[st.assigneeId] : null;
        return [
          st.ticketId || '',
          'Subtask',
          `  - ${st.title}`,
          task.projectName,
          task.columnName,
          task.priority,
          stAssignee?.name || 'Unassigned',
          creator?.name || 'Unknown',
          st.createdAt,
          st.id,
          ''
        ].map(escapeCsvField).join(',');
      });

      return [taskRow, ...subtaskRows];
  });

  const csvContent = [headers.join(','), ...rows].join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    const timestamp = new Date().toISOString().slice(0, 10);
    const sanitizedProjectName = projectName.replace(/\s+/g, '_').toLowerCase();
    link.setAttribute('href', url);
    link.setAttribute('download', `tasks_export_${sanitizedProjectName}_${timestamp}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

export const exportTasksToPdf = (tasks: AugmentedTask[], projectName: string) => {
  const doc = new jsPDF('landscape');
  const timestamp = new Date().toLocaleString();
  
  doc.setFontSize(18);
  doc.text(`${projectName} - Project Tasks`, 14, 20);
  doc.setFontSize(10);
  doc.text(`Generated on: ${timestamp}`, 14, 30);

  const tableColumn = ["ID", "Type", "Title", "Status", "Priority", "Assignee", "Created At"];
  const tableRows: any[] = [];

  tasks.forEach(task => {
    tableRows.push([
      task.ticketId || '',
      'Task',
      task.title,
      task.columnName,
      task.priority,
      task.assignee?.name || 'Unassigned',
      new Date(task.createdAt).toLocaleDateString()
    ]);

    if (task.subtasks && task.subtasks.length > 0) {
      task.subtasks.forEach(st => {
        tableRows.push([
          st.ticketId || '',
          'Subtask',
          `    - ${st.title}`, // Use standard dash for better compatibility
          task.columnName,
          '-',
          'Unassigned',
          st.createdAt ? new Date(st.createdAt).toLocaleDateString() : '-'
        ]);
      });
    }
  });

  autoTable(doc, {
    head: [tableColumn],
    body: tableRows,
    startY: 40,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [16, 185, 129] }, // Emerald color
    didDrawCell: (data: any) => {
      // Optional: highlight subtask rows differently if needed
      if (data.row.raw[1] === 'Subtask') {
        // data.cell.styles.textColor = [100, 100, 100];
      }
    }
  });

  doc.save(`${projectName.replace(/\s+/g, '_')}_tasks_${new Date().toISOString().slice(0,10)}.pdf`);
};


