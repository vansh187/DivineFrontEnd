export interface DashboardStory {
  id: string;
  label: string;
  poster: string;
  video: string;
  eyebrow: string;
  headline: string;
}

/** Instagram-style story reels shown on the customer/broker dashboard home,
 *  so the first thing after login isn't a blank white page. Each plays with
 *  its own audio track (autoplay-with-sound, falling back to muted if the
 *  browser blocks it) since the viewer is opened by a tap. */
export const dashboardStories: DashboardStory[] = [
  {
    id: 'ops-divine-intro',
    label: 'Divine Greens',
    poster: '/stories/ops-divine-intro-poster.jpg',
    video: '/stories/ops-divine-intro.mp4',
    eyebrow: 'Now selling',
    headline: 'Introducing OPS Divine Greens.',
  },
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
    label: 'Divine Greens tour',
    poster: '/stories/ops-divine-tour-poster.jpg',
    video: '/stories/ops-divine-tour.mp4',
    eyebrow: 'Now selling',
    headline: 'A closer look at OPS Divine Greens.',
  },
];
