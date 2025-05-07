export interface Project {
  project_id: number;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string | null;
  status: 'planning' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled';
  budget: number | null;
  facility_id: number | null;
  project_manager: string | null;
  priority: 'low' | 'medium' | 'high' | 'critical';
  created_at: string;
  updated_at: string;
}

export interface EquipmentInstallation {
  installation_id: number;
  project_id: number;
  equipment_name: string;
  equipment_type: string | null;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  planned_installation_date: string | null;
  actual_installation_date: string | null;
  status: 'pending' | 'ordered' | 'delivered' | 'installed' | 'tested' | 'operational' | 'delayed';
  location_in_facility: string | null;
  installation_notes: string | null;
  dependencies: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectMilestone {
  milestone_id: number;
  project_id: number;
  name: string;
  description: string | null;
  due_date: string | null;
  completion_date: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'delayed';
  created_at: string;
  updated_at: string;
}

export interface ProjectTask {
  task_id: number;
  project_id: number;
  milestone_id: number | null;
  installation_id: number | null;
  name: string;
  description: string | null;
  assignee: string | null;
  start_date: string | null;
  end_date: string | null;
  status: 'not_started' | 'in_progress' | 'completed' | 'blocked' | 'delayed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  created_at: string;
  updated_at: string;
}

export interface ProjectRisk {
  risk_id: number;
  project_id: number;
  name: string;
  description: string | null;
  impact: 'low' | 'medium' | 'high' | 'critical';
  probability: 'low' | 'medium' | 'high' | 'certain';
  status: 'identified' | 'monitoring' | 'mitigated' | 'occurred' | 'closed';
  mitigation_plan: string | null;
  contingency_plan: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectDocument {
  document_id: number;
  project_id: number;
  name: string;
  file_path: string | null;
  document_type: string | null;
  upload_date: string;
  uploader: string | null;
  description: string | null;
}

export interface ProjectNote {
  note_id: number;
  project_id: number;
  author: string | null;
  content: string;
  created_at: string;
}

export interface EquipmentDependency {
  dependency_id: number;
  equipment_id: number;
  depends_on_id: number;
  dependency_type: string | null;
  notes: string | null;
  created_at: string;
}

export interface TimelineItem {
  id: string;
  title: string;
  start_date: string;
  end_date?: string;
  color?: string;
  type: 'milestone' | 'task' | 'equipment';
  status: string;
  dependencies?: string[];
}

export interface ProjectTimeline {
  tasks: ProjectTask[];
  equipment: EquipmentInstallation[];
  milestones: ProjectMilestone[];
  dependencies: EquipmentDependency[];
} 