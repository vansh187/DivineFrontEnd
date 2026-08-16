import { useNavigate } from 'react-router-dom';
import { useAuth, getDisplayName } from '../hooks/useAuth';
import { DashboardLayout, PlaceholderCard } from '../components/DashboardLayout';
import { BrokerDocuments } from '../components/BrokerDocuments';
import { UsersIcon, TagIcon, ChartIcon } from '../components/DashboardIcons';

export function BrokerPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const name = session ? getDisplayName(session) : 'there';

  return (
    <DashboardLayout
      eyebrow="Broker workspace"
      heading={<>Welcome back, {name}.</>}
      subheading="Schedule site visits first, then manage broker documents and the rest of your workspace."
      before={<BrokerDocuments />}
    >
      <PlaceholderCard
        icon={<UsersIcon />}
        accent="chrome"
        title="My leads"
        description="Customers you're working with, and where each one is in the corridor."
      />
      <PlaceholderCard
        icon={<TagIcon />}
        accent="terracotta"
        title="Listings"
        description="Plots you're actively representing across Suraksha Enclave and OPS Divine Greens."
      />
      <PlaceholderCard
        icon={<ChartIcon />}
        accent="green-soft"
        title="Commission"
        description="Add paid cash commission records and review payout status."
        actionLabel="Open details"
        onAction={() => navigate('/broker/commission')}
      />
    </DashboardLayout>
  );
}
