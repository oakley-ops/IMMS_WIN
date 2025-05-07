import axios from 'axios';
import { 
  Project, 
  EquipmentInstallation, 
  ProjectMilestone, 
  ProjectTask,
  ProjectRisk,
  ProjectTimeline,
  EquipmentDependency
} from '../types/project';
import mockProjects from '../mockData/projects';
import mockEquipment from '../mockData/equipment';
import mockMilestones from '../mockData/milestones';
import mockTasks from '../mockData/tasks';
import mockDependencies from '../mockData/dependencies';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

// Projects
export const getAllProjects = async (): Promise<Project[]> => {
  // Use mock data instead of API call
  return Promise.resolve(mockProjects);
  
  // Original API call code:
  // const response = await axios.get(`${API_URL}/projects`, {
  //   headers: {
  //     Authorization: `Bearer ${localStorage.getItem('token')}`
  //   }
  // });
  // return response.data;
};

export const getProjectById = async (id: number): Promise<Project> => {
  // Use mock data instead of API call
  const project = mockProjects.find(p => p.project_id === id);
  if (!project) {
    throw new Error(`Project with ID ${id} not found`);
  }
  return Promise.resolve(project);
  
  // Original API call code:
  // const response = await axios.get(`${API_URL}/projects/${id}`, {
  //   headers: {
  //     Authorization: `Bearer ${localStorage.getItem('token')}`
  //   }
  // });
  // return response.data;
};

export const createProject = async (project: Omit<Project, 'project_id' | 'created_at' | 'updated_at'>): Promise<Project> => {
  // Mock creating a project
  // Use timestamp to create unique IDs, avoiding conflicts with mock data
  const timestamp = new Date().getTime();
  const uniqueId = Math.floor(timestamp / 1000) + 10000; // Convert to seconds and add offset
  
  const newProject: Project = {
    ...project as any,
    project_id: uniqueId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  mockProjects.push(newProject);
  return Promise.resolve(newProject);
  
  // Original API call code:
  // const response = await axios.post(`${API_URL}/projects`, project, {
  //   headers: {
  //     Authorization: `Bearer ${localStorage.getItem('token')}`
  //   }
  // });
  // return response.data;
};

export const updateProject = async (id: number, project: Partial<Project>): Promise<Project> => {
  // Mock updating a project
  const index = mockProjects.findIndex(p => p.project_id === id);
  if (index === -1) {
    throw new Error(`Project with ID ${id} not found`);
  }
  
  const updatedProject: Project = {
    ...mockProjects[index],
    ...project,
    updated_at: new Date().toISOString()
  };
  
  mockProjects[index] = updatedProject;
  return Promise.resolve(updatedProject);
  
  // Original API call code:
  // const response = await axios.put(`${API_URL}/projects/${id}`, project, {
  //   headers: {
  //     Authorization: `Bearer ${localStorage.getItem('token')}`
  //   }
  // });
  // return response.data;
};

export const deleteProject = async (id: number): Promise<void> => {
  // Mock deleting a project
  const index = mockProjects.findIndex(p => p.project_id === id);
  if (index === -1) {
    throw new Error(`Project with ID ${id} not found`);
  }
  
  mockProjects.splice(index, 1);
  return Promise.resolve();
  
  // Original API call code:
  // await axios.delete(`${API_URL}/projects/${id}`, {
  //   headers: {
  //     Authorization: `Bearer ${localStorage.getItem('token')}`
  //   }
  // });
};

// Equipment Installations
export const getProjectEquipment = async (projectId: number): Promise<EquipmentInstallation[]> => {
  // Use mock data
  const equipment = mockEquipment.filter(e => e.project_id === projectId);
  return Promise.resolve(equipment);
  
  // Original API call code:
  // const response = await axios.get(`${API_URL}/projects/${projectId}/equipment`, {
  //   headers: {
  //     Authorization: `Bearer ${localStorage.getItem('token')}`
  //   }
  // });
  // return response.data;
};

export const createEquipment = async (equipment: Omit<EquipmentInstallation, 'installation_id' | 'created_at' | 'updated_at'>): Promise<EquipmentInstallation> => {
  // Mock creating equipment
  const newEquipment: EquipmentInstallation = {
    ...equipment as any,
    installation_id: mockEquipment.length > 0 ? Math.max(...mockEquipment.map(e => e.installation_id)) + 1 : 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  mockEquipment.push(newEquipment);
  return Promise.resolve(newEquipment);
  
  // Original API call code:
  // const response = await axios.post(`${API_URL}/equipment`, equipment, {
  //   headers: {
  //     Authorization: `Bearer ${localStorage.getItem('token')}`
  //   }
  // });
  // return response.data;
};

export const updateEquipment = async (id: number, equipment: Partial<EquipmentInstallation>): Promise<EquipmentInstallation> => {
  // Mock updating equipment
  const index = mockEquipment.findIndex(e => e.installation_id === id);
  if (index === -1) {
    throw new Error(`Equipment with ID ${id} not found`);
  }
  
  const updatedEquipment: EquipmentInstallation = {
    ...mockEquipment[index],
    ...equipment,
    updated_at: new Date().toISOString()
  };
  
  mockEquipment[index] = updatedEquipment;
  return Promise.resolve(updatedEquipment);
  
  // Original API call code:
  // const response = await axios.put(`${API_URL}/equipment/${id}`, equipment, {
  //   headers: {
  //     Authorization: `Bearer ${localStorage.getItem('token')}`
  //   }
  // });
  // return response.data;
};

export const deleteEquipment = async (id: number): Promise<void> => {
  // Mock deleting equipment
  const index = mockEquipment.findIndex(e => e.installation_id === id);
  if (index === -1) {
    throw new Error(`Equipment with ID ${id} not found`);
  }
  
  mockEquipment.splice(index, 1);
  return Promise.resolve();
  
  // Original API call code:
  // await axios.delete(`${API_URL}/equipment/${id}`, {
  //   headers: {
  //     Authorization: `Bearer ${localStorage.getItem('token')}`
  //   }
  // });
};

// Equipment Dependencies
export const getEquipmentDependencies = async (equipmentId: number): Promise<EquipmentDependency[]> => {
  // Use mock data
  const dependencies = mockDependencies.filter(d => d.equipment_id === equipmentId);
  return Promise.resolve(dependencies);
  
  // Original API call code:
  // const response = await axios.get(`${API_URL}/equipment/${equipmentId}/dependencies`, {
  //   headers: {
  //     Authorization: `Bearer ${localStorage.getItem('token')}`
  //   }
  // });
  // return response.data;
};

export const addEquipmentDependency = async (equipmentId: number, dependency: { depends_on_id: number, dependency_type?: string, notes?: string }): Promise<EquipmentDependency> => {
  // Mock adding a dependency
  const newDependency: EquipmentDependency = {
    dependency_id: mockDependencies.length > 0 ? Math.max(...mockDependencies.map(d => d.dependency_id)) + 1 : 1,
    equipment_id: equipmentId,
    depends_on_id: dependency.depends_on_id,
    dependency_type: dependency.dependency_type || null,
    notes: dependency.notes || null,
    created_at: new Date().toISOString()
  };
  
  mockDependencies.push(newDependency);
  return Promise.resolve(newDependency);
  
  // Original API call code:
  // const response = await axios.post(`${API_URL}/equipment/${equipmentId}/dependencies`, dependency, {
  //   headers: {
  //     Authorization: `Bearer ${localStorage.getItem('token')}`
  //   }
  // });
  // return response.data;
};

// Project Milestones
export const getProjectMilestones = async (projectId: number): Promise<ProjectMilestone[]> => {
  // Use mock data
  const milestones = mockMilestones.filter(m => m.project_id === projectId);
  return Promise.resolve(milestones);
  
  // Original API call code:
  // const response = await axios.get(`${API_URL}/projects/${projectId}/milestones`, {
  //   headers: {
  //     Authorization: `Bearer ${localStorage.getItem('token')}`
  //   }
  // });
  // return response.data;
};

export const createMilestone = async (milestone: Omit<ProjectMilestone, 'milestone_id' | 'created_at' | 'updated_at'>): Promise<ProjectMilestone> => {
  // Mock creating a milestone
  const newMilestone: ProjectMilestone = {
    ...milestone as any,
    milestone_id: Math.max(...mockMilestones.map(m => m.milestone_id), 0) + 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  mockMilestones.push(newMilestone);
  return Promise.resolve(newMilestone);
  
  // Original API call code:
  // const response = await axios.post(`${API_URL}/milestones`, milestone, {
  //   headers: {
  //     Authorization: `Bearer ${localStorage.getItem('token')}`
  //   }
  // });
  // return response.data;
};

export const updateMilestone = async (id: number, milestone: Partial<ProjectMilestone>): Promise<ProjectMilestone> => {
  // Mock updating a milestone
  const index = mockMilestones.findIndex(m => m.milestone_id === id);
  if (index === -1) {
    throw new Error(`Milestone with ID ${id} not found`);
  }
  
  const updatedMilestone: ProjectMilestone = {
    ...mockMilestones[index],
    ...milestone,
    updated_at: new Date().toISOString()
  };
  
  mockMilestones[index] = updatedMilestone;
  return Promise.resolve(updatedMilestone);
  
  // Original API call code:
  // const response = await axios.put(`${API_URL}/milestones/${id}`, milestone, {
  //   headers: {
  //     Authorization: `Bearer ${localStorage.getItem('token')}`
  //   }
  // });
  // return response.data;
};

export const deleteMilestone = async (id: number): Promise<void> => {
  // Mock deleting a milestone
  const index = mockMilestones.findIndex(m => m.milestone_id === id);
  if (index === -1) {
    throw new Error(`Milestone with ID ${id} not found`);
  }
  
  mockMilestones.splice(index, 1);
  return Promise.resolve();
  
  // Original API call code:
  // await axios.delete(`${API_URL}/milestones/${id}`, {
  //   headers: {
  //     Authorization: `Bearer ${localStorage.getItem('token')}`
  //   }
  // });
};

// Project Tasks
export const getProjectTasks = async (projectId: number): Promise<ProjectTask[]> => {
  // Use mock data
  const tasks = mockTasks.filter(t => t.project_id === projectId);
  return Promise.resolve(tasks);
  
  // Original API call code:
  // const response = await axios.get(`${API_URL}/projects/${projectId}/tasks`, {
  //   headers: {
  //     Authorization: `Bearer ${localStorage.getItem('token')}`
  //   }
  // });
  // return response.data;
};

export const createTask = async (task: Omit<ProjectTask, 'task_id' | 'created_at' | 'updated_at'>): Promise<ProjectTask> => {
  // Mock creating a task
  const newTask: ProjectTask = {
    ...task as any,
    task_id: Math.max(...mockTasks.map(t => t.task_id), 0) + 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  mockTasks.push(newTask);
  return Promise.resolve(newTask);
  
  // Original API call code:
  // const response = await axios.post(`${API_URL}/tasks`, task, {
  //   headers: {
  //     Authorization: `Bearer ${localStorage.getItem('token')}`
  //   }
  // });
  // return response.data;
};

export const updateTask = async (id: number, task: Partial<ProjectTask>): Promise<ProjectTask> => {
  // Mock updating a task
  const index = mockTasks.findIndex(t => t.task_id === id);
  if (index === -1) {
    throw new Error(`Task with ID ${id} not found`);
  }
  
  const updatedTask: ProjectTask = {
    ...mockTasks[index],
    ...task,
    updated_at: new Date().toISOString()
  };
  
  mockTasks[index] = updatedTask;
  return Promise.resolve(updatedTask);
  
  // Original API call code:
  // const response = await axios.put(`${API_URL}/tasks/${id}`, task, {
  //   headers: {
  //     Authorization: `Bearer ${localStorage.getItem('token')}`
  //   }
  // });
  // return response.data;
};

export const deleteTask = async (id: number): Promise<void> => {
  // Mock deleting a task
  const index = mockTasks.findIndex(t => t.task_id === id);
  if (index === -1) {
    throw new Error(`Task with ID ${id} not found`);
  }
  
  mockTasks.splice(index, 1);
  return Promise.resolve();
  
  // Original API call code:
  // await axios.delete(`${API_URL}/tasks/${id}`, {
  //   headers: {
  //     Authorization: `Bearer ${localStorage.getItem('token')}`
  //   }
  // });
};

// Project Timeline
export const getProjectTimeline = async (projectId: number): Promise<ProjectTimeline> => {
  // Mock timeline data using our mock collections
  const projectEquipment = mockEquipment.filter(e => e.project_id === projectId);
  const projectMilestones = mockMilestones.filter(m => m.project_id === projectId);
  const projectTasks = mockTasks.filter(t => t.project_id === projectId);
  const equipmentIds = projectEquipment.map(e => e.installation_id);
  const projectDependencies = mockDependencies.filter(d => 
    equipmentIds.includes(d.equipment_id) || equipmentIds.includes(d.depends_on_id)
  );
  
  // Return mock timeline
  return Promise.resolve({
    equipment: projectEquipment,
    milestones: projectMilestones,
    tasks: projectTasks,
    dependencies: projectDependencies
  });
  
  // Original API call code:
  // const response = await axios.get(`${API_URL}/projects/${projectId}/timeline`, {
  //   headers: {
  //     Authorization: `Bearer ${localStorage.getItem('token')}`
  //   }
  // });
  // return response.data;
}; 