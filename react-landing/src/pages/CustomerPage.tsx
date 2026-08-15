import { useAuth, getDisplayName } from '../hooks/useAuth';
import { DashboardLayout, PlaceholderCard } from '../components/DashboardLayout';
import { CustomerDocuments } from '../components/CustomerDocuments';
import { BookmarkIcon, CalendarIcon } from '../components/DashboardIcons';

export function CustomerPage() {
  const { session } = useAuth();
  const name = session ? getDisplayName(session) : 'there';

  return (
    <DashboardLayout
      eyebrow="Customer workspace"
      heading={<>Welcome back, {name}.</>}
      subheading="Your shortlist and site visits will live here as we build out the customer portal — documents are ready below."
      after={<CustomerDocuments />}
    >
      <PlaceholderCard
        icon={<BookmarkIcon />}
        title="Saved townships"
        description="Bookmark plots along the corridor and compare them side by side."
      />
      <PlaceholderCard
        icon={<CalendarIcon />}
        title="Site visits"
        description="Track upcoming visits and revisit past ones with your broker."
      />
    </DashboardLayout>
  );
}
