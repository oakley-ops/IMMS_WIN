import { ProjectMilestone } from '../types/project';

const mockMilestones: ProjectMilestone[] = [
  {
    milestone_id: 1,
    project_id: 1,
    name: "Site Survey Complete",
    description: "Initial site measurements and utility assessment for kitchen remodel",
    due_date: "2025-03-05",
    completion_date: "2025-03-03",
    status: "completed",
    created_at: "2025-02-18T09:15:00Z",
    updated_at: "2025-03-03T16:30:00Z"
  },
  {
    milestone_id: 2,
    project_id: 1,
    name: "Equipment Selection Finalized",
    description: "All kitchen equipment specifications and vendors finalized",
    due_date: "2025-03-10",
    completion_date: "2025-03-10",
    status: "completed",
    created_at: "2025-02-20T10:20:00Z",
    updated_at: "2025-03-10T14:45:00Z"
  },
  {
    milestone_id: 3,
    project_id: 1,
    name: "Building Permits Approved",
    description: "All required building and health department permits secured",
    due_date: "2025-03-20",
    completion_date: "2025-03-22",
    status: "completed",
    created_at: "2025-02-25T09:25:00Z",
    updated_at: "2025-03-22T11:30:00Z"
  },
  {
    milestone_id: 4,
    project_id: 1,
    name: "Kitchen Layout Installation",
    description: "Plumbing, electrical, and ventilation infrastructure completed",
    due_date: "2025-04-05",
    completion_date: null,
    status: "in_progress",
    created_at: "2025-03-01T11:30:00Z",
    updated_at: "2025-03-25T09:45:00Z"
  },
  {
    milestone_id: 5,
    project_id: 1,
    name: "Final Inspection",
    description: "Health department and building inspector final approval",
    due_date: "2025-05-10",
    completion_date: null,
    status: "pending",
    created_at: "2025-03-05T14:35:00Z",
    updated_at: "2025-03-05T14:35:00Z"
  },
  {
    milestone_id: 6,
    project_id: 2,
    name: "Kitchen Design Approved",
    description: "Final approval of expanded banquet kitchen design by hotel management",
    due_date: "2025-04-10",
    completion_date: null,
    status: "in_progress",
    created_at: "2025-03-01T10:00:00Z",
    updated_at: "2025-03-20T15:20:00Z"
  },
  {
    milestone_id: 7,
    project_id: 2,
    name: "Equipment Orders Placed",
    description: "All major kitchen equipment orders submitted to vendors",
    due_date: "2025-04-25",
    completion_date: null,
    status: "pending",
    created_at: "2025-03-05T10:05:00Z",
    updated_at: "2025-03-05T10:05:00Z"
  },
  {
    milestone_id: 8,
    project_id: 3,
    name: "Cafeteria Menu Planning",
    description: "Finalize equipment choices based on new menu requirements",
    due_date: "2025-06-10",
    completion_date: null,
    status: "pending",
    created_at: "2025-03-15T11:15:00Z",
    updated_at: "2025-03-15T11:15:00Z"
  },
  {
    milestone_id: 9,
    project_id: 4,
    name: "Temporary Kitchen Setup",
    description: "Establish temporary food service facilities during main kitchen renovation",
    due_date: "2025-04-25",
    completion_date: null,
    status: "pending",
    created_at: "2025-03-18T13:30:00Z",
    updated_at: "2025-03-18T13:30:00Z"
  },
  {
    milestone_id: 10,
    project_id: 5,
    name: "Equipment Standards Document",
    description: "Standardized specification document for all franchise locations",
    due_date: "2025-04-30",
    completion_date: null,
    status: "pending",
    created_at: "2025-03-20T09:45:00Z",
    updated_at: "2025-03-20T09:45:00Z"
  }
];

export default mockMilestones; 