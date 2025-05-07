import { Project } from '../types/project';

const mockProjects: Project[] = [
  {
    project_id: 1,
    name: "Restaurant Kitchen Remodel",
    description: "Complete kitchen renovation for Giovanni's Italian Restaurant",
    start_date: "2025-03-01",
    end_date: "2025-05-15",
    status: "in_progress",
    budget: 125000,
    facility_id: 101,
    project_manager: "Maria Rodriguez",
    priority: "high",
    created_at: "2025-02-15T10:00:00Z",
    updated_at: "2025-03-10T14:30:00Z"
  },
  {
    project_id: 2,
    name: "Hotel Banquet Kitchen Expansion",
    description: "Expansion of the Grand Plaza Hotel banquet kitchen to increase capacity",
    start_date: "2025-04-01",
    end_date: "2025-07-30",
    status: "planning",
    budget: 280000,
    facility_id: 102,
    project_manager: "James Wilson",
    priority: "critical",
    created_at: "2025-02-20T09:15:00Z",
    updated_at: "2025-02-20T09:15:00Z"
  },
  {
    project_id: 3,
    name: "School Cafeteria Upgrade",
    description: "Modernization of cafeteria kitchen equipment at Westside High School",
    start_date: "2025-06-15",
    end_date: "2025-08-20",
    status: "planning",
    budget: 95000,
    facility_id: 103,
    project_manager: "Sarah Johnson",
    priority: "medium",
    created_at: "2025-03-05T13:45:00Z",
    updated_at: "2025-03-05T13:45:00Z"
  },
  {
    project_id: 4,
    name: "Hospital Kitchen Renovation",
    description: "Complete renovation of St. Mary's Hospital main kitchen",
    start_date: "2025-05-01",
    end_date: "2025-09-30",
    status: "planning",
    budget: 350000,
    facility_id: 104,
    project_manager: "Robert Chen",
    priority: "high",
    created_at: "2025-03-12T11:30:00Z",
    updated_at: "2025-03-12T11:30:00Z"
  },
  {
    project_id: 5,
    name: "Fast Food Chain Kitchen Standardization",
    description: "Standardizing kitchen equipment across 12 Burger Barn locations",
    start_date: "2025-04-10",
    end_date: "2025-11-15",
    status: "planning",
    budget: 420000,
    facility_id: 105,
    project_manager: "Thomas Davis",
    priority: "medium",
    created_at: "2025-03-18T10:20:00Z",
    updated_at: "2025-03-18T10:20:00Z"
  }
];

export default mockProjects; 