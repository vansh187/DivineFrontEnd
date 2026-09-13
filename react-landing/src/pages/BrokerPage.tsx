import { useNavigate } from 'react-router-dom';
import { useAuth, getDisplayName } from '../hooks/useAuth';
import { DashboardLayout, PlaceholderCard } from '../components/DashboardLayout';
import { BrokerDocuments } from '../components/BrokerDocuments';
import { UsersIcon, TagIcon, ChartIcon } from '../components/DashboardIcons';
import { StoriesBar } from '../components/stories/StoriesBar';

export function BrokerPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const name = session ? getDisplayName(session) : 'there';

  return (
    <DashboardLayout
      eyebrow="Broker workspace"
      heading={<>Welcome back, {name}.</>}
      subheading="Schedule site visits first, then manage broker documents and the rest of your workspace."
      before={
        <>
          <div className="mt-6">
            <StoriesBar />
          </div>
          <BrokerDocuments />
        </>
      }
    >
      <PlaceholderCard
        icon={<UsersIcon />}
        accent="chrome"
        title="My leads"
        description="Plots you've reserved and locked for 3 days, and who you're visiting them with."
        actionLabel="View leads"
        onAction={() => navigate('/broker/leads')}
      />
      <PlaceholderCard
        icon={<TagIcon />}
        accent="terracotta"
        title="Available plots"
        description="Plot inventory is managed by the sales team — talk to us for current availability."
        actionLabel="View plots"
        disabled
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
