# Project Management System - Setup Guide

## 🚀 Getting Started

The project management system is now configured to work with **real database storage**. All mock data has been removed, and you can start creating and tracking your own projects.

## ✅ Setup Steps

### 1. Create Database Tables

Run the setup script to create all necessary database tables:

```bash
cd backend
node setup-project-tables.js
```

This will create the following tables:
- `projects` - Main project information
- `equipment_installations` - Equipment tracking
- `project_milestones` - Project milestones
- `project_tasks` - Tasks and assignments
- `project_risks` - Risk management (optional)
- `project_documents` - Document tracking (optional)
- `project_notes` - Project notes (optional)
- `equipment_dependencies` - Equipment installation dependencies

### 2. Start the Backend Server

Make sure your backend server is running:

```bash
cd backend
npm start
```

The server should be running on `http://localhost:4000`

### 3. Start the Frontend

In a separate terminal, start the frontend:

```bash
cd frontend
npm start
```

The frontend should be running on `http://localhost:3000`

### 4. Access the Project Management System

1. Log in to your application
2. Navigate to **Projects** in the main menu
3. Click **"New Project"** to create your first project

## 📋 How to Use

### Creating a Project

1. Click the **"New Project"** button
2. Fill in the project details:
   - **Project Name*** (required)
   - **Start Date*** (required)
   - **End Date** (optional)
   - **Status** (Planning, In Progress, On Hold, Completed, Cancelled)
   - **Priority** (Low, Medium, High, Critical)
   - **Budget** (optional)
   - **Project Manager** (optional)
   - **Description** (optional)
3. Click **"Create Project"**

### Managing Projects

**View Projects:**
- All projects are displayed in a searchable, filterable table
- Use the search bar to find specific projects
- Filter by status and priority
- Toggle "Show active projects only" to hide completed/cancelled projects

**Edit a Project:**
- Click the orange **Edit** button (pencil icon) on any project
- Update the fields you want to change
- Click **"Update Project"**

**Delete a Project:**
- Click the red **Delete** button (trash icon)
- Confirm the deletion
- ⚠️ This will also delete all associated equipment, milestones, and tasks

**View Project Timeline:**
- Click the blue **Timeline** button on any project
- This opens the detailed timeline view

### Project Timeline & Equipment

Once you've created a project, click the **Timeline** button to:

#### Add Equipment
1. Click **"Add Equipment"**
2. Fill in equipment details:
   - Equipment name, type, manufacturer, model
   - Serial number, location in facility
   - Planned and actual installation dates
   - Status (Pending → Ordered → Delivered → Installed → Tested → Operational)
   - Installation notes
3. Click **"Save"**

#### Add Milestones
1. Click **"Add Milestone"**
2. Enter milestone name, description, due date, and status
3. Click **"Save"**

#### Add Tasks
1. Click **"Add Task"**
2. Enter task details, assignee, dates, and priority
3. Click **"Save"**

#### Add Dependencies
1. Click **"Add Dependency"**
2. Select an equipment item
3. Select what it depends on
4. This creates an installation sequence

### Tracking Progress

**Status Progression:**

Projects:
- Planning → In Progress → On Hold → Completed/Cancelled

Equipment:
- Pending → Ordered → Delivered → Installed → Tested → Operational

Tasks:
- Not Started → In Progress → Completed/Blocked/Delayed

**Visual Indicators:**
- Color-coded status chips
- Timeline visualization
- Dependency arrows
- Statistics summary

### Exporting Data

Click the **"Export"** button to download all projects as an Excel file with:
- Project name, description, status, priority
- Project manager, dates, budget
- Created and updated timestamps

## 🎯 Features

✅ **Full CRUD Operations** - Create, Read, Update, Delete projects
✅ **Equipment Tracking** - Track equipment through installation lifecycle
✅ **Milestone Management** - Set and track project milestones
✅ **Task Assignment** - Assign tasks to team members
✅ **Dependency Management** - Define installation order
✅ **Timeline Visualization** - See project progress chronologically
✅ **Search & Filter** - Find projects quickly
✅ **Excel Export** - Export project data
✅ **Real-time Updates** - Changes save immediately to database

## 🔐 Permissions

The project management system requires the `CAN_MANAGE_PROJECTS` permission.

By default:
- **Admin users** have full access
- Other roles need explicit permission assignment

## 📊 Database Schema

All data is stored in PostgreSQL with proper relationships:
- Projects cascade delete to equipment, milestones, tasks
- Equipment can have dependencies on other equipment
- Tasks can link to milestones or equipment installations
- Full audit trail with created_at and updated_at timestamps

## 🆘 Troubleshooting

**"Failed to load projects" error:**
- Check that the backend server is running
- Verify database connection in `.env` file
- Run the setup script to create tables
- Check browser console for detailed errors

**Can't see Projects menu:**
- Verify you're logged in
- Check your user has `CAN_MANAGE_PROJECTS` permission
- Contact your administrator to grant permission

**Tables already exist warning:**
- This is normal if you've run the setup before
- The script will skip existing tables
- Your data is safe

## 📝 Notes

- All data is now stored in the database (no more mock data)
- Start with an empty slate - create projects as needed
- Projects can be tracked from planning through completion
- Use the timeline view for detailed project management
- Export data regularly for backup purposes

## 🎉 You're Ready!

Your project management system is now fully interactive and ready to use. Start by creating your first project and tracking it through to completion!







