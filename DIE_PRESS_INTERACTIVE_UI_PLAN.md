# Interactive Die Press Management UI - Development Plan

## Overview

Create a separate interactive test page that provides a visual, drag-and-drop interface for managing dies in die press machines. Users can visually see die press machines, drag dies out to remove them, and drag replacement dies from a "shelf" to install them.

---

## Concept Design

```
+------------------------------------------------------------------+
|                    DIE PRESS MANAGEMENT                           |
+------------------------------------------------------------------+
|                                                                   |
|  +---------------------------+    +---------------------------+   |
|  |     DIE PRESS 702         |    |     DIE PRESS 704         |   |
|  |    [Machine Image]        |    |    [Machine Image]        |   |
|  |                           |    |                           |   |
|  |   +------------------+    |    |   +------------------+    |   |
|  |   |   DIE #104       |    |    |   |    EMPTY         |    |   |
|  |   |   4 up die       |<---+--->|   |   Drop die here  |    |   |
|  |   |   [Draggable]    |    |    |   |                  |    |   |
|  |   +------------------+    |    |   +------------------+    |   |
|  |                           |    |                           |   |
|  +---------------------------+    +---------------------------+   |
|                                                                   |
+------------------------------------------------------------------+
|                      AVAILABLE DIES (SHELF)                       |
+------------------------------------------------------------------+
|                                                                   |
|  +--------+  +--------+  +--------+  +--------+  +--------+      |
|  |Die #101|  |Die #105|  |Die #108|  |Die #112|  |Die #115|      |
|  |4 up    |  |4 up    |  |8 up    |  |4 up    |  |8 up    |      |
|  | SHARP  |  | USED   |  | SHARP  |  | SHARP  |  | USED   |      |
|  +--------+  +--------+  +--------+  +--------+  +--------+      |
|                                                                   |
+------------------------------------------------------------------+
```

---

## Features

### 1. Die Press Machine Cards
- Visual representation of each die press machine
- Shows machine name, location, and image/icon
- Displays currently installed die (if any)
- Drop zone for installing new dies
- Visual feedback when dragging over (highlight, glow)

### 2. Die Shelf
- Shows all available dies (SHARP and USED status)
- Dies displayed as draggable cards
- Shows die number, type, and status (color-coded)
- Filter options (by type, status)
- Search functionality

### 3. Drag and Drop Interactions
- **Remove Die**: Drag die from machine to shelf or "removal zone"
- **Install Die**: Drag die from shelf to machine drop zone
- Visual feedback during drag (shadow, opacity)
- Confirmation animation on successful drop
- Error feedback if incompatible (shake animation)

### 4. Compatibility Validation
- Check die's `compatible_machine_ids` before allowing drop
- Visual indicator showing compatible machines when dragging
- Error message if trying to install incompatible die

---

## Technical Implementation

### Technology Stack
- **React** - Component framework
- **react-beautiful-dnd** or **@dnd-kit/core** - Drag and drop library
- **Framer Motion** - Animations and transitions
- **Material-UI** - UI components and styling

### Recommended Library: `@dnd-kit/core`
- Modern, lightweight, accessible
- Better performance than react-beautiful-dnd
- Supports multiple drag sources and drop targets
- Good TypeScript support

### Component Structure

```
src/
  pages/
    DieInteractive.tsx          # Main page component
  components/
    dieInteractive/
      DiePressCard.tsx          # Machine card with drop zone
      DieChip.tsx               # Draggable die component
      DieShelf.tsx              # Shelf container for available dies
      RemovalZone.tsx           # Zone to drop dies for removal
      CompatibilityIndicator.tsx # Shows compatible machines
```

---

## Implementation Phases

### Phase 1: Basic Layout & Static UI
- [ ] Create new route `/die-interactive`
- [ ] Build DiePressCard component (static)
- [ ] Build DieShelf component (static)
- [ ] Add machine images/icons
- [ ] Style with Fiserv branding

### Phase 2: Drag and Drop Foundation
- [ ] Install @dnd-kit/core and @dnd-kit/sortable
- [ ] Make dies draggable (DieChip component)
- [ ] Add drop zones to machine cards
- [ ] Implement basic drag/drop state management

### Phase 3: API Integration
- [ ] Fetch die press machines on load
- [ ] Fetch available dies (SHARP/USED status)
- [ ] Call install API on successful drop to machine
- [ ] Call remove API on drag out of machine
- [ ] Handle loading and error states

### Phase 4: Validation & Feedback
- [ ] Check compatible_machine_ids before allowing drop
- [ ] Show visual feedback for valid/invalid drops
- [ ] Add animations (success, error, drag states)
- [ ] Display compatibility indicators when dragging

### Phase 5: Polish & Enhancements
- [ ] Add filter/search for shelf dies
- [ ] Add confirmation dialog for removals
- [ ] Add technician selection for tracking
- [ ] Mobile/touch support
- [ ] Add sound effects (optional)

---

## API Endpoints Used

| Action | Method | Endpoint |
|--------|--------|----------|
| Get machines | GET | `/api/v1/machines?machine_type=Die Press` |
| Get available dies | GET | `/api/v1/dies?status=SHARP,USED` |
| Install die | POST | `/api/v1/dies/:id/install` |
| Remove die | POST | `/api/v1/dies/:id/remove` |

---

## State Management

```typescript
interface DieInteractiveState {
  machines: Machine[];           // Die press machines with current dies
  availableDies: Die[];          // Dies on the shelf (SHARP/USED)
  draggingDie: Die | null;       // Currently dragged die
  loading: boolean;
  error: string | null;
}
```

---

## Visual Design Notes

### Machine Card
- Size: ~300px x 400px
- Header: Machine name + location
- Body: Machine image (placeholder or actual photo)
- Die slot: Centered area showing installed die or "Empty" state
- Border glow when valid drop target

### Die Chip (Draggable)
- Size: ~100px x 80px
- Shows: Die number, type, status badge
- Color-coded border by status (green=Sharp, red=Used)
- Shadow effect when dragging
- Slight rotation when picked up

### Shelf
- Horizontal scrollable row or grid
- Background resembling a shelf/rack
- Clear visual separation from machines

---

## Sample Code Structure

```tsx
// DieInteractive.tsx (main page)
import { DndContext, DragEndEvent } from '@dnd-kit/core';

const DieInteractive = () => {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [availableDies, setAvailableDies] = useState<Die[]>([]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) return;

    const dieId = active.id;
    const targetType = over.data.current?.type;

    if (targetType === 'machine') {
      // Install die in machine
      await installDie(dieId, over.id);
    } else if (targetType === 'shelf') {
      // Remove die from machine
      await removeDie(dieId);
    }
  };

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <Box className="die-interactive-page">
        <Typography variant="h4">Die Press Management</Typography>

        <Grid container spacing={3}>
          {machines.map(machine => (
            <DiePressCard key={machine.machine_id} machine={machine} />
          ))}
        </Grid>

        <DieShelf dies={availableDies} />
      </Box>
    </DndContext>
  );
};
```

---

## Success Criteria

1. User can see all die press machines with their current dies
2. User can drag a die from the shelf to an empty machine to install it
3. User can drag a die out of a machine to remove it
4. Incompatible dies show error feedback and cannot be dropped
5. All changes persist to the database via API calls
6. Page is responsive and works on tablet/touch devices
7. Visual feedback is clear and intuitive

---

## Future Enhancements

- Real-time updates via WebSocket (multiple users)
- Die history preview on hover
- Machine maintenance status indicators
- Batch operations (swap dies between machines)
- Print/export current die assignments
- Mobile app version

---

## Timeline Estimate

| Phase | Estimated Effort |
|-------|------------------|
| Phase 1: Basic Layout | 2-3 hours |
| Phase 2: Drag & Drop | 3-4 hours |
| Phase 3: API Integration | 2-3 hours |
| Phase 4: Validation | 2-3 hours |
| Phase 5: Polish | 2-4 hours |
| **Total** | **11-17 hours** |

---

## Getting Started

To begin implementation, run:
```bash
cd frontend
npm install @dnd-kit/core @dnd-kit/sortable framer-motion
```

Then create the new page component and add the route to the app.
