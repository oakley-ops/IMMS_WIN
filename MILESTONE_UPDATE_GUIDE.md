# How to Update Milestones - User Guide

## Overview

Milestones can now be edited directly from the **Timeline view** in your project. This allows you to track progress, update statuses, and manage milestone completion dates.

## Accessing the Timeline View

1. Navigate to **Projects Management**
2. Click on any project name to view project details
3. Click the **Timeline** icon (📅) to open the Timeline & Equipment Installation Schedule

## How to Update a Milestone

### Step 1: Locate the Milestone

In the timeline view, milestones are displayed with:
- 🏁 **"Milestone"** badge
- Color-coded status indicator
- Due date on the left
- Milestone name and description

### Step 2: Click the Edit Button

- Look for the **pencil/edit icon** (✏️) in the top-right corner of the milestone card
- Click the edit icon to open the milestone editor

### Step 3: Update Milestone Fields

The milestone editor allows you to modify:

| Field | Purpose | Notes |
|-------|---------|-------|
| **Milestone Name** | The title of the milestone | Required |
| **Description** | Details about what this milestone represents | Optional |
| **Due Date** | When the milestone should be completed | Can be updated |
| **Completion Date** | Actual date when milestone was finished | Set when marking as completed |
| **Status** | Current state of the milestone | See status options below |

### Step 4: Change Status

Select from 4 status options:

- **Pending** - Not yet started (gray)
- **In Progress** - Currently being worked on (blue)
- **Completed** - Milestone achieved (green)
- **Delayed** - Behind schedule (red)

### Step 5: Set Completion Date

When marking a milestone as **Completed**:
1. Change status to "Completed"
2. Set the **Completion Date** to today's date (or actual completion date)
3. This tracks how long the milestone took vs. the due date

### Step 6: Save Changes

- Click **"Save"** to update the milestone
- The timeline will automatically refresh with the new information
- Project progress percentage updates automatically based on completed milestones

## How Progress is Calculated

Project progress is calculated as:

```
Progress % = (Completed Milestones / Total Milestones) × 100
```

**Example:**
- Project has 7 milestones
- 3 marked as "Completed"
- Progress = (3 / 7) × 100 = **43%**

## Visual Indicators

### Status Colors

- **Gray** (#9e9e9e) - Pending
- **Blue** (#2196f3) - In Progress  
- **Green** (#4caf50) - Completed
- **Red** (#f44336) - Delayed

### Timeline Dots

Each milestone appears on the timeline with a colored dot matching its status.

## Best Practices

### ✓ DO

- **Update status regularly** - Keep milestones current for accurate progress tracking
- **Set completion dates** - Track actual vs. planned timelines
- **Use "In Progress"** - Show what's actively being worked on
- **Mark as "Delayed"** - Flag milestones that are behind schedule for visibility

### ✗ DON'T

- **Don't skip statuses** - Move through Pending → In Progress → Completed naturally
- **Don't leave old statuses** - Update as soon as milestone status changes
- **Don't forget completion dates** - Record these when marking complete

## Quick Actions

### Update Multiple Milestones

To quickly update several milestones:
1. Open the Timeline view
2. Click edit on each milestone card
3. Update status and save
4. Progress updates after each save

### Mark Milestone Complete

Quick checklist:
- [ ] Click edit button on milestone
- [ ] Change status to "Completed"
- [ ] Set completion date to today
- [ ] Click "Save"
- [ ] Verify project progress updated

## Common Scenarios

### Scenario 1: Milestone Completed Early

1. Click edit on the milestone
2. Set status to "Completed"
3. Set completion date to actual completion date (before due date)
4. Save

### Scenario 2: Milestone is Behind Schedule

1. Click edit on the milestone
2. Change status to "Delayed"
3. Optionally update due date if extending timeline
4. Add notes in description about delay reason
5. Save

### Scenario 3: Starting Work on Next Milestone

1. Find the previous milestone, mark as "Completed"
2. Find the next milestone
3. Click edit
4. Change status from "Pending" to "In Progress"
5. Save

## Keyboard Shortcuts

Currently, all milestone updates are done through the UI. There are no keyboard shortcuts yet.

## Troubleshooting

**Q: I don't see the edit button on milestones**  
A: Make sure you're viewing the Timeline tab, not the main project list. Only the Timeline view shows edit buttons.

**Q: Progress percentage isn't updating**  
A: Refresh the project list page. Progress is recalculated when you view the list.

**Q: Can I delete milestones?**  
A: Currently, milestones can only be edited. Deletion functionality may be added in a future update.

**Q: What if I accidentally mark something complete?**  
A: Just click edit again and change the status back to "In Progress" or "Pending".

## Integration with Project Progress

- Progress bars on the main project list update based on milestone completion
- Each completed milestone contributes equally to overall progress
- Pending, In Progress, and Delayed milestones count as 0% complete
- Only "Completed" status milestones count toward the project total

## Tips for Effective Milestone Tracking

1. **Set realistic due dates** when creating projects
2. **Review milestones weekly** to keep status current
3. **Use descriptions** to document important details or blockers
4. **Track completion dates** to analyze project velocity
5. **Update status immediately** when milestone state changes

## Future Enhancements

Planned features for milestone management:
- Milestone comments/notes
- Milestone dependencies
- Automated notifications for due/overdue milestones
- Bulk status updates
- Milestone history/audit log
- Export milestone data

## Need Help?

For additional assistance:
- Check `PROJECT_MANAGEMENT_REDESIGN.md` for technical details
- Review `QUICK_START_REDESIGN.md` for setup instructions
- Contact your system administrator for access issues

---

**Last Updated:** December 22, 2025  
**Feature Version:** 1.0
