import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stepper,
  Step,
  StepLabel,
  TextField,
  Grid,
  MenuItem,
  Box,
  Typography,
  Card,
  CardContent,
  CardActionArea,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  Business as BusinessIcon,
  Close as CloseIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  BuildCircle as BuildCircleIcon,
  Computer as ComputerIcon,
  Build as BuildIcon,
  AddCircle as AddCircleIcon,
} from '@mui/icons-material';
import { format, addDays } from 'date-fns';
import { PROJECT_TEMPLATES, calculateMilestoneDates, ProjectTemplate } from '../../config/milestoneTemplates';
import { Project } from '../../types/project';

interface ProjectCreationWizardProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (projectData: Partial<Project>, milestones: any[]) => Promise<void>;
}

const steps = ['Project Details', 'Select Template', 'Configure Milestones', 'Review'];

const templateIcons: { [key: string]: React.ReactElement } = {
  'BuildCircle': <BuildCircleIcon sx={{ fontSize: 48, color: '#FF6600' }} />,
  'Business': <BusinessIcon sx={{ fontSize: 48, color: '#FF6600' }} />,
  'Computer': <ComputerIcon sx={{ fontSize: 48, color: '#FF6600' }} />,
  'Build': <BuildIcon sx={{ fontSize: 48, color: '#FF6600' }} />,
  'AddCircle': <AddCircleIcon sx={{ fontSize: 48, color: '#FF6600' }} />,
};

export const ProjectCreationWizard: React.FC<ProjectCreationWizardProps> = ({
  open,
  onClose,
  onSubmit
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ProjectTemplate | null>(null);
  
  const [projectData, setProjectData] = useState<Partial<Project>>({
    name: '',
    description: '',
    start_date: format(new Date(), 'yyyy-MM-dd'),
    end_date: '',
    status: 'planning',
    budget: 0,
    project_manager: '',
    priority: 'medium'
  });

  const [milestones, setMilestones] = useState<Array<{
    name: string;
    description: string;
    due_date: string;
    status: string;
  }>>([]);

  const handleNext = () => {
    if (activeStep === 1 && selectedTemplate && selectedTemplate.milestones.length > 0) {
      const startDate = new Date(projectData.start_date || new Date());
      const endDate = projectData.end_date ? new Date(projectData.end_date) : undefined;
      
      const calculatedMilestones = calculateMilestoneDates(
        startDate,
        selectedTemplate.milestones,
        endDate
      ).map(m => ({ ...m, status: 'pending' }));
      setMilestones(calculatedMilestones);
    }
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handleReset = () => {
    setActiveStep(0);
    setSelectedTemplate(null);
    setProjectData({
      name: '',
      description: '',
      start_date: format(new Date(), 'yyyy-MM-dd'),
      end_date: '',
      status: 'planning',
      budget: 0,
      project_manager: '',
      priority: 'medium'
    });
    setMilestones([]);
  };

  const handleProjectDataChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setProjectData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleTemplateSelect = (template: ProjectTemplate) => {
    setSelectedTemplate(template);
  };

  const handleAddMilestone = () => {
    const newMilestone = {
      name: '',
      description: '',
      due_date: format(addDays(new Date(projectData.start_date || new Date()), 7), 'yyyy-MM-dd'),
      status: 'pending'
    };
    setMilestones([...milestones, newMilestone]);
  };

  const handleMilestoneChange = (index: number, field: string, value: string) => {
    const updatedMilestones = [...milestones];
    updatedMilestones[index] = {
      ...updatedMilestones[index],
      [field]: value
    };
    setMilestones(updatedMilestones);
  };

  const handleDeleteMilestone = (index: number) => {
    setMilestones(milestones.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      await onSubmit(projectData, milestones);
      handleReset();
      onClose();
    } catch (error) {
      console.error('Error creating project:', error);
    } finally {
      setLoading(false);
    }
  };

  const isStepValid = (step: number): boolean => {
    switch (step) {
      case 0:
        if (!projectData.name || !projectData.start_date) return false;
        // Validate end date is after start date if provided
        if (projectData.end_date) {
          const startDate = new Date(projectData.start_date);
          const endDate = new Date(projectData.end_date);
          if (endDate < startDate) return false;
        }
        return true;
      case 1:
        return !!selectedTemplate;
      case 2:
        return milestones.every(m => m.name && m.due_date);
      case 3:
        return true;
      default:
        return false;
    }
  };

  const renderStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TextField
                required
                fullWidth
                label="Project Name"
                name="name"
                value={projectData.name}
                onChange={handleProjectDataChange}
                sx={{
                  '& .MuiOutlinedInput-root.Mui-focused fieldset': {
                    borderColor: '#FF6600',
                  },
                  '& .MuiInputLabel-root.Mui-focused': {
                    color: '#FF6600',
                  },
                }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Description"
                name="description"
                value={projectData.description}
                onChange={handleProjectDataChange}
                sx={{
                  '& .MuiOutlinedInput-root.Mui-focused fieldset': {
                    borderColor: '#FF6600',
                  },
                  '& .MuiInputLabel-root.Mui-focused': {
                    color: '#FF6600',
                  },
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                required
                fullWidth
                label="Start Date"
                name="start_date"
                type="date"
                value={projectData.start_date}
                onChange={handleProjectDataChange}
                InputLabelProps={{ shrink: true }}
                sx={{
                  '& .MuiOutlinedInput-root.Mui-focused fieldset': {
                    borderColor: '#FF6600',
                  },
                  '& .MuiInputLabel-root.Mui-focused': {
                    color: '#FF6600',
                  },
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="End Date (Optional)"
                name="end_date"
                type="date"
                value={projectData.end_date}
                onChange={handleProjectDataChange}
                InputLabelProps={{ shrink: true }}
                error={!!(projectData.end_date && projectData.start_date && new Date(projectData.end_date) < new Date(projectData.start_date))}
                helperText={
                  projectData.end_date && projectData.start_date && new Date(projectData.end_date) < new Date(projectData.start_date)
                    ? 'End date must be after start date'
                    : projectData.end_date
                    ? 'Milestones will be scaled to fit within this timeline'
                    : 'Leave empty for flexible timeline'
                }
                sx={{
                  '& .MuiOutlinedInput-root.Mui-focused fieldset': {
                    borderColor: '#FF6600',
                  },
                  '& .MuiInputLabel-root.Mui-focused': {
                    color: '#FF6600',
                  },
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                select
                fullWidth
                label="Priority"
                name="priority"
                value={projectData.priority}
                onChange={handleProjectDataChange}
                sx={{
                  '& .MuiOutlinedInput-root.Mui-focused fieldset': {
                    borderColor: '#FF6600',
                  },
                  '& .MuiInputLabel-root.Mui-focused': {
                    color: '#FF6600',
                  },
                }}
              >
                <MenuItem value="low">Low</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="high">High</MenuItem>
                <MenuItem value="critical">Critical</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Budget"
                name="budget"
                type="number"
                value={projectData.budget}
                onChange={handleProjectDataChange}
                sx={{
                  '& .MuiOutlinedInput-root.Mui-focused fieldset': {
                    borderColor: '#FF6600',
                  },
                  '& .MuiInputLabel-root.Mui-focused': {
                    color: '#FF6600',
                  },
                }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Project Manager"
                name="project_manager"
                value={projectData.project_manager}
                onChange={handleProjectDataChange}
                sx={{
                  '& .MuiOutlinedInput-root.Mui-focused fieldset': {
                    borderColor: '#FF6600',
                  },
                  '& .MuiInputLabel-root.Mui-focused': {
                    color: '#FF6600',
                  },
                }}
              />
            </Grid>
          </Grid>
        );

      case 1:
        return (
          <Box>
            <Typography variant="h6" gutterBottom sx={{ color: '#0066A1', mb: 3 }}>
              Choose a project template to get started with pre-configured milestones
            </Typography>
            <Grid container spacing={2}>
              {PROJECT_TEMPLATES.map((template) => (
                <Grid item xs={12} sm={6} md={4} key={template.id}>
                  <Card
                    sx={{
                      height: '100%',
                      border: selectedTemplate?.id === template.id ? '2px solid #FF6600' : '1px solid #e0e0e0',
                      backgroundColor: selectedTemplate?.id === template.id ? 'rgba(255, 102, 0, 0.05)' : 'white',
                      transition: 'all 0.2s',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                      }
                    }}
                  >
                    <CardActionArea onClick={() => handleTemplateSelect(template)} sx={{ height: '100%', p: 2 }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                          {templateIcons[template.icon]}
                        </Box>
                        <Typography variant="h6" gutterBottom align="center" sx={{ color: '#0066A1' }}>
                          {template.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 2 }}>
                          {template.description}
                        </Typography>
                        <Chip
                          label={`${template.milestones.length} milestones`}
                          size="small"
                          sx={{
                            backgroundColor: '#0066A1',
                            color: 'white',
                            display: 'block',
                            width: 'fit-content',
                            mx: 'auto'
                          }}
                        />
                      </CardContent>
                    </CardActionArea>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        );

      case 2:
        return (
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h6" sx={{ color: '#0066A1' }}>
                Configure Project Milestones
              </Typography>
              <Button
                startIcon={<AddIcon />}
                onClick={handleAddMilestone}
                sx={{
                  backgroundColor: '#FF6600',
                  color: 'white',
                  '&:hover': { backgroundColor: '#e65c00' }
                }}
              >
                Add Milestone
              </Button>
            </Box>
            
            {milestones.length === 0 ? (
              <Alert severity="info">
                No milestones added yet. Click "Add Milestone" to create your first milestone, or go back and select a template.
              </Alert>
            ) : (
              <List>
                {milestones.map((milestone, index) => (
                  <ListItem
                    key={index}
                    sx={{
                      mb: 2,
                      border: '1px solid #e0e0e0',
                      borderRadius: '8px',
                      flexDirection: 'column',
                      alignItems: 'stretch',
                      p: 2
                    }}
                  >
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          required
                          fullWidth
                          size="small"
                          label="Milestone Name"
                          value={milestone.name}
                          onChange={(e) => handleMilestoneChange(index, 'name', e.target.value)}
                          sx={{
                            '& .MuiOutlinedInput-root.Mui-focused fieldset': {
                              borderColor: '#FF6600',
                            },
                            '& .MuiInputLabel-root.Mui-focused': {
                              color: '#FF6600',
                            },
                          }}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          required
                          fullWidth
                          size="small"
                          label="Due Date"
                          type="date"
                          value={milestone.due_date}
                          onChange={(e) => handleMilestoneChange(index, 'due_date', e.target.value)}
                          InputLabelProps={{ shrink: true }}
                          sx={{
                            '& .MuiOutlinedInput-root.Mui-focused fieldset': {
                              borderColor: '#FF6600',
                            },
                            '& .MuiInputLabel-root.Mui-focused': {
                              color: '#FF6600',
                            },
                          }}
                        />
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          size="small"
                          multiline
                          rows={2}
                          label="Description"
                          value={milestone.description}
                          onChange={(e) => handleMilestoneChange(index, 'description', e.target.value)}
                          sx={{
                            '& .MuiOutlinedInput-root.Mui-focused fieldset': {
                              borderColor: '#FF6600',
                            },
                            '& .MuiInputLabel-root.Mui-focused': {
                              color: '#FF6600',
                            },
                          }}
                        />
                      </Grid>
                    </Grid>
                    <ListItemSecondaryAction>
                      <IconButton
                        edge="end"
                        onClick={() => handleDeleteMilestone(index)}
                        sx={{ color: '#f44336' }}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            )}
          </Box>
        );

      case 3:
        return (
          <Box>
            <Typography variant="h6" gutterBottom sx={{ color: '#0066A1', mb: 3 }}>
              Review Your Project
            </Typography>
            
            <Card sx={{ mb: 3, p: 3 }}>
              <Typography variant="subtitle1" sx={{ color: '#FF6600', fontWeight: 'bold', mb: 2 }}>
                Project Details
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">Name:</Typography>
                  <Typography variant="body1" sx={{ fontWeight: 'bold' }}>{projectData.name}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">Priority:</Typography>
                  <Chip label={projectData.priority?.toUpperCase()} size="small" color="primary" />
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary">Description:</Typography>
                  <Typography variant="body1">{projectData.description || 'No description'}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">Start Date:</Typography>
                  <Typography variant="body1">{projectData.start_date ? format(new Date(projectData.start_date), 'MMM d, yyyy') : 'N/A'}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">Budget:</Typography>
                  <Typography variant="body1">${projectData.budget?.toLocaleString()}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">Project Manager:</Typography>
                  <Typography variant="body1">{projectData.project_manager || 'Not assigned'}</Typography>
                </Grid>
              </Grid>
            </Card>

            <Card sx={{ p: 3 }}>
              <Typography variant="subtitle1" sx={{ color: '#FF6600', fontWeight: 'bold', mb: 2 }}>
                Milestones ({milestones.length})
              </Typography>
              {milestones.length === 0 ? (
                <Alert severity="warning">No milestones configured</Alert>
              ) : (
                <List>
                  {milestones.map((milestone, index) => (
                    <ListItem key={index} sx={{ borderBottom: '1px solid #e0e0e0' }}>
                      <ListItemText
                        primary={
                          <Typography sx={{ fontWeight: 'bold', color: '#0066A1' }}>
                            {index + 1}. {milestone.name}
                          </Typography>
                        }
                        secondary={
                          <>
                            <Typography variant="body2" color="text.secondary">
                              {milestone.description}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Due: {format(new Date(milestone.due_date), 'MMM d, yyyy')}
                            </Typography>
                          </>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </Card>
          </Box>
        );

      default:
        return 'Unknown step';
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      sx={{
        '& .MuiDialog-paper': {
          borderRadius: '12px',
          minHeight: '600px'
        }
      }}
    >
      <DialogTitle sx={{ backgroundColor: '#0066A1', color: 'white', borderRadius: '12px 12px 0 0' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <BusinessIcon sx={{ mr: 1, color: '#FF6600' }} />
            <Typography variant="h6" sx={{ color: 'white' }}>
              Create New Project
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small" sx={{ color: 'white' }}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 3, mt: 2 }}>
        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel
                sx={{
                  '& .MuiStepLabel-label.Mui-active': {
                    color: '#FF6600',
                    fontWeight: 'bold'
                  },
                  '& .MuiStepLabel-label.Mui-completed': {
                    color: '#0066A1'
                  },
                  '& .MuiStepIcon-root.Mui-active': {
                    color: '#FF6600'
                  },
                  '& .MuiStepIcon-root.Mui-completed': {
                    color: '#0066A1'
                  }
                }}
              >
                {label}
              </StepLabel>
            </Step>
          ))}
        </Stepper>

        <Box sx={{ minHeight: '400px' }}>
          {renderStepContent(activeStep)}
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 3, borderTop: '1px solid #e0e0e0' }}>
        <Button onClick={onClose} sx={{ color: '#666' }}>
          Cancel
        </Button>
        <Box sx={{ flex: '1 1 auto' }} />
        <Button
          disabled={activeStep === 0}
          onClick={handleBack}
          sx={{ color: '#0066A1' }}
        >
          Back
        </Button>
        {activeStep === steps.length - 1 ? (
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={loading}
            sx={{
              backgroundColor: '#FF6600',
              '&:hover': { backgroundColor: '#e65c00' }
            }}
          >
            {loading ? (
              <>
                <CircularProgress size={16} sx={{ mr: 1, color: 'white' }} />
                Creating...
              </>
            ) : (
              'Create Project'
            )}
          </Button>
        ) : (
          <Button
            variant="contained"
            onClick={handleNext}
            disabled={!isStepValid(activeStep)}
            sx={{
              backgroundColor: '#FF6600',
              '&:hover': { backgroundColor: '#e65c00' }
            }}
          >
            Next
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default ProjectCreationWizard;
