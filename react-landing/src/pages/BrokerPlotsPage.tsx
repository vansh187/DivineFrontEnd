import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../components/DashboardLayout';
import { AvailablePlotsList } from '../components/AvailablePlotsList';
import { ScheduleVisitModal } from '../components/ScheduleVisitModal';
import type { InventoryUnit } from '../services/inventoryApi';

export function BrokerPlotsPage() {
  const navigate = useNavigate();
  const [scheduleUnit, setScheduleUnit] = useState<InventoryUnit | null>(null);
  const [refreshSignal, setRefreshSignal] = useState(0);

  return (
    <DashboardLayout heading={<>Available plots</>} contentLayout="full">
      <AvailablePlotsList actionLabel="Schedule Visit" onAction={setScheduleUnit} refreshSignal={refreshSignal} />
      {scheduleUnit && (
        <ScheduleVisitModal
          unit={scheduleUnit}
          onClose={() => setScheduleUnit(null)}
          onReserved={() => {
            setScheduleUnit(null);
            setRefreshSignal((value) => value + 1);
            navigate('/broker/leads');
          }}
        />
      )}
    </DashboardLayout>
  );
}
