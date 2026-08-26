import { useNavigate } from 'react-router-dom';
import { BrokerCommission } from '../components/BrokerCommission';
import { DashboardLayout } from '../components/DashboardLayout';
import { useAuth } from '../hooks/useAuth';

export function BrokerCommissionPage() {
  const { session } = useAuth();
  const navigate = useNavigate();

  return (
    <DashboardLayout
      eyebrow="Broker workspace"
      heading={<>Commission</>}
      subheading="Review your commission summary and history by status and month."
      contentLayout="full"
    >
      <BrokerCommission token={session?.token ?? ''} brokerId={session?.userId ?? ''} onBack={() => navigate('/broker')} />
    </DashboardLayout>
  );
}
