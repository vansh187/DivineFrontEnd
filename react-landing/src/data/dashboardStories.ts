export interface DashboardStory {
  id: string;
  label: string;
  poster: string;
  video: string;
  eyebrow: string;
  headline: string;
}

/** Instagram-style story reels shown on the customer/broker dashboard home,
 *  so the first thing after login isn't a blank white page. Videos are
 *  cinematic township-lifestyle renders — kept short and silent (no audio
 *  track assumptions) since they autoplay inside the viewer. */
export const dashboardStories: DashboardStory[] = [
  {
    id: 'garden-life',
    label: 'Garden & parks',
    poster: '/stories/garden-life-poster.jpg',
    video: '/stories/garden-life.mp4',
    eyebrow: 'Everyday life',
    headline: 'Mornings that start in your own park.',
  },
  {
    id: 'township-walk',
    label: 'Township walk',
    poster: '/stories/township-walk-poster.jpg',
    video: '/stories/township-walk.mp4',
    eyebrow: 'The neighbourhood',
    headline: 'Streets designed for the walk home.',
  },
  {
    id: 'ops-divine-tour',
    label: 'OPS Divine Greens',
    poster: '/stories/ops-divine-tour-poster.jpg',
    video: '/stories/ops-divine-tour.mp4',
    eyebrow: 'Now selling',
    headline: 'A closer look at OPS Divine Greens.',
  },
];
