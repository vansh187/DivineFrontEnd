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
        title="Available plots"
        description="Browse plots currently available to sell and schedule a site visit."
        actionLabel="View plots"
        onAction={() => navigate('/broker/plots')}
      />
      <PlaceholderCard
        icon={<ChartIcon />}
        accent="green-soft"
        title="Commission"
        description="Review your commission summary, history, and monthly trend."
        actionLabel="Open details"
        onAction={() => navigate('/broker/commission')}
      />
    </DashboardLayout>
  );
}
