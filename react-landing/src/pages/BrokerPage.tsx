import { useState } from 'react';
import { useAuth, getDisplayName } from '../hooks/useAuth';
import { DashboardLayout, PlaceholderCard } from '../components/DashboardLayout';
import { BrokerCommission } from '../components/BrokerCommission';
import { BrokerDocuments } from '../components/BrokerDocuments';
import { UsersIcon, TagIcon, ChartIcon } from '../components/DashboardIcons';

export function BrokerPage() {
  const { session } = useAuth();
  const name = session ? getDisplayName(session) : 'there';
  const email = session?.email ?? 'anonymous';
  const [commissionOpen, setCommissionOpen] = useState(false);

  if (commissionOpen) {
    return (
      <DashboardLayout
        eyebrow="Broker workspace"
        heading={<>Commission</>}
        subheading="Calculate the broker's 1% commission and review commission records by payout status."
      >
        <BrokerCommission email={email} onBack={() => setCommissionOpen(false)} />
      </DashboardLayout>
    );
  }

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
        description="Track closed bookings and payouts as they come in."
        actionLabel="Open details"
        onAction={() => setCommissionOpen(true)}
      />
    </DashboardLayout>
  );
}
