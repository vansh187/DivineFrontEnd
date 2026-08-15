import { useAuth, getDisplayName } from '../hooks/useAuth';
import { DashboardLayout, PlaceholderCard } from '../components/DashboardLayout';
import { BrokerDocuments } from '../components/BrokerDocuments';
import { UsersIcon, TagIcon, ChartIcon } from '../components/DashboardIcons';

export function BrokerPage() {
  const { session } = useAuth();
  const name = session ? getDisplayName(session) : 'there';

  return (
    <DashboardLayout
      eyebrow="Broker workspace"
      heading={<>Welcome back, {name}.</>}
      subheading="Your leads, listings and commission tracking will live here as we build out the broker portal — documents and scheduling are ready below."
      after={<BrokerDocuments />}
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
        description="Track closed bookings and payouts as they come in."
      />
    </DashboardLayout>
  );
}
