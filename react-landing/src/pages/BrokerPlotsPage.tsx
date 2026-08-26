import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../components/DashboardLayout';
import { AvailablePlotsList } from '../components/AvailablePlotsList';
import type { InventoryUnit } from '../services/inventoryApi';

function buildVisitNote(unit: InventoryUnit) {
  const parts = [unit.project_name, unit.unit_number ? `Plot ${unit.unit_number}` : null, [unit.locality, unit.city].filter(Boolean).join(', ')].filter(
    Boolean,
  );
  return `Site visit for ${parts.join(' · ')}`;
}

export function BrokerPlotsPage() {
  const navigate = useNavigate();

  const handleScheduleVisit = (unit: InventoryUnit) => {
    navigate('/broker', { state: { scheduleVisitNote: buildVisitNote(unit) } });
  };

  return (
    <DashboardLayout heading={<>Available plots</>} contentLayout="full">
      <AvailablePlotsList actionLabel="Schedule Visit" onAction={handleScheduleVisit} />
    </DashboardLayout>
  );
}
