export interface MilestoneTemplate {
  name: string;
  description: string;
  daysFromStart: number;
}

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  milestones: MilestoneTemplate[];
}

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'equipment_installation',
    name: 'Equipment Installation',
    description: 'Complete equipment installation project with testing and validation',
    icon: 'BuildCircle',
    milestones: [
      {
        name: 'Project Kickoff',
        description: 'Initial planning and resource allocation',
        daysFromStart: 0
      },
      {
        name: 'Site Preparation',
        description: 'Prepare installation site and verify requirements',
        daysFromStart: 7
      },
      {
        name: 'Equipment Procurement',
        description: 'Order and receive equipment',
        daysFromStart: 14
      },
      {
        name: 'Installation Complete',
        description: 'Physical installation of equipment',
        daysFromStart: 30
      },
      {
        name: 'Testing & Validation',
        description: 'Test equipment and validate functionality',
        daysFromStart: 45
      },
      {
        name: 'Go-Live & Training',
        description: 'Final handover and user training',
        daysFromStart: 60
      },
      {
        name: 'Project Closure',
        description: 'Documentation and project review',
        daysFromStart: 70
      }
    ]
  },
  {
    id: 'facility_upgrade',
    name: 'Facility Upgrade',
    description: 'Major facility renovation or upgrade project',
    icon: 'Business',
    milestones: [
      {
        name: 'Requirements Gathering',
        description: 'Collect and document all requirements',
        daysFromStart: 0
      },
      {
        name: 'Design & Planning',
        description: 'Create detailed design and implementation plan',
        daysFromStart: 14
      },
      {
        name: 'Vendor Selection',
        description: 'Select and contract with vendors',
        daysFromStart: 28
      },
      {
        name: 'Phase 1 Completion',
        description: 'Complete first phase of upgrades',
        daysFromStart: 60
      },
      {
        name: 'Phase 2 Completion',
        description: 'Complete second phase of upgrades',
        daysFromStart: 90
      },
      {
        name: 'Final Inspection',
        description: 'Conduct final inspection and approval',
        daysFromStart: 120
      }
    ]
  },
  {
    id: 'system_deployment',
    name: 'System Deployment',
    description: 'Deploy new software or hardware system',
    icon: 'Computer',
    milestones: [
      {
        name: 'Planning & Analysis',
        description: 'Analyze requirements and create deployment plan',
        daysFromStart: 0
      },
      {
        name: 'Development Environment Setup',
        description: 'Set up development and testing environments',
        daysFromStart: 7
      },
      {
        name: 'Development Complete',
        description: 'Complete system development',
        daysFromStart: 30
      },
      {
        name: 'UAT Testing',
        description: 'User acceptance testing',
        daysFromStart: 45
      },
      {
        name: 'Production Deployment',
        description: 'Deploy to production environment',
        daysFromStart: 60
      },
      {
        name: 'Post-Deployment Support',
        description: 'Monitor and provide support',
        daysFromStart: 75
      }
    ]
  },
  {
    id: 'maintenance_project',
    name: 'Maintenance Project',
    description: 'Scheduled maintenance or repair project',
    icon: 'Build',
    milestones: [
      {
        name: 'Assessment',
        description: 'Assess maintenance requirements',
        daysFromStart: 0
      },
      {
        name: 'Parts & Materials',
        description: 'Order necessary parts and materials',
        daysFromStart: 7
      },
      {
        name: 'Maintenance Execution',
        description: 'Perform maintenance activities',
        daysFromStart: 14
      },
      {
        name: 'Quality Check',
        description: 'Verify maintenance quality',
        daysFromStart: 21
      },
      {
        name: 'Sign-off',
        description: 'Final approval and documentation',
        daysFromStart: 28
      }
    ]
  },
  {
    id: 'custom',
    name: 'Custom Project',
    description: 'Start with a blank template and add your own milestones',
    icon: 'AddCircle',
    milestones: []
  }
];

export const getTemplateById = (id: string): ProjectTemplate | undefined => {
  return PROJECT_TEMPLATES.find(template => template.id === id);
};

export const calculateMilestoneDates = (
  startDate: Date,
  milestones: MilestoneTemplate[],
  endDate?: Date
): Array<{ name: string; description: string; due_date: string }> => {
  if (!endDate || milestones.length === 0) {
    // No end date provided, use original logic with fixed offsets
    return milestones.map(milestone => {
      const dueDate = new Date(startDate);
      dueDate.setDate(dueDate.getDate() + milestone.daysFromStart);
      return {
        name: milestone.name,
        description: milestone.description,
        due_date: dueDate.toISOString().split('T')[0]
      };
    });
  }

  // Calculate total project duration in days
  const projectDurationMs = endDate.getTime() - startDate.getTime();
  const projectDurationDays = Math.ceil(projectDurationMs / (1000 * 60 * 60 * 24));

  // Find the maximum days in the template
  const maxTemplateDays = Math.max(...milestones.map(m => m.daysFromStart));

  // If project is shorter than template, we need to scale
  if (projectDurationDays < maxTemplateDays) {
    // Scale milestones proportionally to fit within project timeline
    return milestones.map(milestone => {
      const scaleFactor = projectDurationDays / maxTemplateDays;
      const scaledDays = Math.round(milestone.daysFromStart * scaleFactor);
      const dueDate = new Date(startDate);
      dueDate.setDate(dueDate.getDate() + scaledDays);
      
      // Ensure milestone doesn't exceed end date
      if (dueDate > endDate) {
        return {
          name: milestone.name,
          description: milestone.description,
          due_date: endDate.toISOString().split('T')[0]
        };
      }
      
      return {
        name: milestone.name,
        description: milestone.description,
        due_date: dueDate.toISOString().split('T')[0]
      };
    });
  } else {
    // Project is longer than template, distribute milestones evenly
    return milestones.map(milestone => {
      const dueDate = new Date(startDate);
      dueDate.setDate(dueDate.getDate() + milestone.daysFromStart);
      
      // Ensure milestone doesn't exceed end date
      if (dueDate > endDate) {
        return {
          name: milestone.name,
          description: milestone.description,
          due_date: endDate.toISOString().split('T')[0]
        };
      }
      
      return {
        name: milestone.name,
        description: milestone.description,
        due_date: dueDate.toISOString().split('T')[0]
      };
    });
  }
};
