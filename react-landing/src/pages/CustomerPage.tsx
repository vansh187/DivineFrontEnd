import { useAuth, getDisplayName } from '../hooks/useAuth';
import { DashboardLayout, PlaceholderCard } from '../components/DashboardLayout';
import { BookmarkIcon, CalendarIcon, FileIcon } from '../components/DashboardIcons';

export function CustomerPage() {
  const { session } = useAuth();
  const name = session ? getDisplayName(session) : 'there';

  return (
    <DashboardLayout
      eyebrow="Customer workspace"
      heading={<>Welcome back, {name}.</>}
      subheading="Your shortlist, site visits and documents will live here as we build out the customer portal."
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
      <PlaceholderCard
        icon={<FileIcon />}
        title="Documents"
        description="Booking forms, DDJAY paperwork and registry documents in one place."
      />
    </DashboardLayout>
  );
}
