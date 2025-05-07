import { EquipmentDependency } from '../types/project';

const mockDependencies: EquipmentDependency[] = [
  {
    dependency_id: 1,
    equipment_id: 3,
    depends_on_id: 1,
    dependency_type: "must be installed after",
    notes: "Pizza oven requires operational gas lines that are installed with the range",
    created_at: "2025-03-01T14:30:00Z"
  },
  {
    dependency_id: 2,
    equipment_id: 4,
    depends_on_id: 2,
    dependency_type: "must be installed after",
    notes: "Dishwasher installation scheduled after walk-in cooler to optimize contractor scheduling",
    created_at: "2025-03-05T10:00:00Z"
  },
  {
    dependency_id: 3,
    equipment_id: 2,
    depends_on_id: 1,
    dependency_type: "installation sequence",
    notes: "Gas range installation must be completed before walk-in cooler due to kitchen workflow",
    created_at: "2025-03-10T09:15:00Z"
  },
  {
    dependency_id: 4,
    equipment_id: 6,
    depends_on_id: 5,
    dependency_type: "must be installed after",
    notes: "Freezer installation follows combi oven due to shared utilities and contractor scheduling",
    created_at: "2025-03-15T13:45:00Z"
  }
];

export default mockDependencies; 