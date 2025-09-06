import { Project } from '../types/project';

const mockProjects: Project[] = [
  {
    project_id: 1,
    name: "Main Kitchen Equipment Installation",
    description: "Installation of core kitchen equipment including gas range, walk-in cooler, pizza oven, and dishwasher",
    start_date: "2025-03-01",
    end_date: "2025-04-15",
    status: "in_progress",
    budget: 125000,
    facility_id: 1,
    project_manager: "Sarah Chen",
    priority: "high",
    created_at: "2025-02-15T10:00:00Z",
    updated_at: "2025-03-18T16:30:00Z"
  },
  {
    project_id: 2,
    name: "Banquet Kitchen Upgrade",
    description: "Installation of combi oven and walk-in freezer for expanded banquet operations",
    start_date: "2025-04-01",
    end_date: "2025-05-01",
    status: "planning",
    budget: 75000,
    facility_id: 1,
    project_manager: "David Lee",
    priority: "medium",
    created_at: "2025-03-01T14:00:00Z",
    updated_at: "2025-03-12T14:15:00Z"
  },
  {
    project_id: 3,
    name: "Cafeteria Service Line Modernization",
    description: "Upgrade cafeteria serving equipment to improve efficiency and food safety",
    start_date: "2025-06-01",
    end_date: "2025-07-15",
    status: "planning",
    budget: 45000,
    facility_id: 2,
    project_manager: "Lisa Johnson",
    priority: "medium",
    created_at: "2025-03-10T11:00:00Z",
    updated_at: "2025-03-15T15:45:00Z"
  },
  {
    project_id: 4,
    name: "Hospital Kitchen Equipment Replacement",
    description: "Replace aging kitchen equipment with modern, energy-efficient models",
    start_date: "2025-05-01",
    end_date: "2025-06-30",
    status: "planning",
    budget: 95000,
    facility_id: 3,
    project_manager: "Mark Williams",
    priority: "high",
    created_at: "2025-03-20T09:30:00Z",
    updated_at: "2025-03-20T11:30:00Z"
  }
];

export default mockProjects; 