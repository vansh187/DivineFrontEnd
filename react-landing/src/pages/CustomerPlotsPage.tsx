import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../components/DashboardLayout';
import { AvailablePlotsList } from '../components/AvailablePlotsList';
import type { InventoryUnit } from '../services/inventoryApi';

export function CustomerPlotsPage() {
  const navigate = useNavigate();

  const handleBook = (unit: InventoryUnit) => {
    // Send the customer to their documents first - Aadhaar, PAN, and photo
    // uploads are required before the application form will accept the
    // booking, so jumping straight to /customer/application would just bounce
    // them back. CustomerPage picks up `unit` from this state and carries it
    // through to the application form once documents are ready.
    navigate('/customer', { state: { unit } });
  };

  return (
    <DashboardLayout
      eyebrow="Customer workspace"
      heading={<>Available plots</>}
      subheading="Browse plots that are currently available across our townships and start a booking."
      contentLayout="full"
    >
      <AvailablePlotsList actionLabel="Book Plot" onAction={handleBook} />
    </DashboardLayout>
  );
}
