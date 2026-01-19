import { 
  Project, 
  EquipmentInstallation, 
  ProjectMilestone, 
  ProjectTask,
  ProjectTimeline,
  EquipmentDependency
} from '../types/project';
import axiosInstance from '../utils/axios';

// Projects
export const getAllProjects = async (): Promise<Project[]> => {
  const response = await axiosInstance.get('/api/v1/projects');
  return response.data;
};

export const getProjectById = async (id: number): Promise<Project> => {
  const response = await axiosInstance.get(`/api/v1/projects/${id}`);
  return response.data;
};

export const createProject = async (project: Omit<Project, 'project_id' | 'created_at' | 'updated_at'>): Promise<Project> => {
  const response = await axiosInstance.post('/api/v1/projects', project);
  return response.data;
};

export const updateProject = async (id: number, project: Partial<Project>): Promise<Project> => {
  const response = await axiosInstance.put(`/api/v1/projects/${id}`, project);
  return response.data;
};

export const deleteProject = async (id: number): Promise<void> => {
  await axiosInstance.delete(`/api/v1/projects/${id}`);
};

// Equipment Installations
export const getProjectEquipment = async (projectId: number): Promise<EquipmentInstallation[]> => {
  const response = await axiosInstance.get(`/api/v1/projects/${projectId}/equipment`);
  return response.data;
};

export const createEquipment = async (equipment: Omit<EquipmentInstallation, 'installation_id' | 'created_at' | 'updated_at'>): Promise<EquipmentInstallation> => {
  const response = await axiosInstance.post('/api/v1/equipment', equipment);
  return response.data;
};

export const updateEquipment = async (id: number, equipment: Partial<EquipmentInstallation>): Promise<EquipmentInstallation> => {
  const response = await axiosInstance.put(`/api/v1/equipment/${id}`, equipment);
  return response.data;
};

export const deleteEquipment = async (id: number): Promise<void> => {
  await axiosInstance.delete(`/api/v1/equipment/${id}`);
};

// Equipment Dependencies
export const getEquipmentDependencies = async (equipmentId: number): Promise<EquipmentDependency[]> => {
  const response = await axiosInstance.get(`/api/v1/equipment/${equipmentId}/dependencies`);
  return response.data;
};

export const addEquipmentDependency = async (equipmentId: number, dependency: { depends_on_id: number, dependency_type?: string, notes?: string }): Promise<EquipmentDependency> => {
  const response = await axiosInstance.post(`/api/v1/equipment/${equipmentId}/dependencies`, dependency);
  return response.data;
};

// Project Milestones
export const getProjectMilestones = async (projectId: number): Promise<ProjectMilestone[]> => {
  const response = await axiosInstance.get(`/api/v1/projects/${projectId}/milestones`);
  return response.data;
};

export const createMilestone = async (milestone: Omit<ProjectMilestone, 'milestone_id' | 'created_at' | 'updated_at'>): Promise<ProjectMilestone> => {
  const response = await axiosInstance.post('/api/v1/milestones', milestone);
  return response.data;
};

export const updateMilestone = async (id: number, milestone: Partial<ProjectMilestone>): Promise<ProjectMilestone> => {
  const response = await axiosInstance.put(`/api/v1/milestones/${id}`, milestone);
  return response.data;
};

export const deleteMilestone = async (id: number): Promise<void> => {
  await axiosInstance.delete(`/api/v1/milestones/${id}`);
};

// Project Tasks
export const getProjectTasks = async (projectId: number): Promise<ProjectTask[]> => {
  const response = await axiosInstance.get(`/api/v1/projects/${projectId}/tasks`);
  return response.data;
};

export const createTask = async (task: Omit<ProjectTask, 'task_id' | 'created_at' | 'updated_at'>): Promise<ProjectTask> => {
  const response = await axiosInstance.post('/api/v1/tasks', task);
  return response.data;
};

export const updateTask = async (id: number, task: Partial<ProjectTask>): Promise<ProjectTask> => {
  const response = await axiosInstance.put(`/api/v1/tasks/${id}`, task);
  return response.data;
};

export const deleteTask = async (id: number): Promise<void> => {
  await axiosInstance.delete(`/api/v1/tasks/${id}`);
};

// Project Timeline
export const getProjectTimeline = async (projectId: number): Promise<ProjectTimeline> => {
  const response = await axiosInstance.get(`/api/v1/projects/${projectId}/timeline`);
  return response.data;
};

// Create Project with Milestones
export const createProjectWithMilestones = async (
  project: Omit<Project, 'project_id' | 'created_at' | 'updated_at'>,
  milestones: Array<{ name: string; description: string; due_date: string; status?: string }>
): Promise<{ project: Project; milestones: ProjectMilestone[] }> => {
  const projectResponse = await axiosInstance.post('/api/v1/projects', project);
  const createdProject = projectResponse.data;

  if (milestones.length > 0) {
    const milestonesResponse = await axiosInstance.post('/api/v1/milestones/bulk', {
      project_id: createdProject.project_id,
      milestones: milestones
    });
    return { project: createdProject, milestones: milestonesResponse.data };
  }

  return { project: createdProject, milestones: [] };
};

// Get Project Progress
export const getProjectProgress = async (projectId: number): Promise<{
  project: Project;
  milestones: {
    total: number;
    completed: number;
    in_progress: number;
    delayed: number;
    pending: number;
  };
  tasks: {
    total: number;
    completed: number;
    in_progress: number;
  };
  progress_percentage: number;
}> => {
  const response = await axiosInstance.get(`/api/v1/projects/${projectId}/progress`);
  return response.data;
};

// Bulk create milestones
export const createMilestonesBulk = async (
  projectId: number,
  milestones: Array<{ name: string; description: string; due_date: string; status?: string }>
): Promise<ProjectMilestone[]> => {
  const response = await axiosInstance.post('/api/v1/milestones/bulk', {
    project_id: projectId,
    milestones: milestones
  });
  return response.data;
}; 