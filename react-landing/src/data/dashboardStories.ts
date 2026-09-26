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
    id: 'drone-entrance',
    label: 'The entrance',
    poster: '/stories/drone-entrance-poster.jpg',
    video: '/stories/drone-entrance.mp4',
    eyebrow: 'OPS Divine Greens',
    headline: 'The gate, the roundabout, the avenue beyond.',
  },
  {
    id: 'drone-clubhouse',
    label: 'Clubhouse',
    poster: '/stories/drone-clubhouse-poster.jpg',
    video: '/stories/drone-clubhouse.mp4',
    eyebrow: 'Already built',
    headline: 'The Florence Club, standing on site.',
  },
  {
    id: 'drone-avenue',
    label: 'Roads & layout',
    poster: '/stories/drone-avenue-poster.jpg',
    video: '/stories/drone-avenue.mp4',
    eyebrow: 'On ground',
    headline: 'Wide roads and plots, laid out and taking shape.',
  },
  {
    id: 'drone-roundabout',
    label: 'Roundabout',
    poster: '/stories/drone-roundabout-poster.jpg',
    video: '/stories/drone-roundabout.mp4',
    eyebrow: 'The heart of the township',
    headline: 'A landscaped roundabout at the gate.',
  },
  {
    id: 'drone-approach',
    label: 'The approach',
    poster: '/stories/drone-approach-poster.jpg',
    video: '/stories/drone-approach.mp4',
    eyebrow: 'Drive in',
    headline: 'A paved approach road leading to the clubhouse.',
  },
  {
    id: 'drone-green',
    label: 'Green corridors',
    poster: '/stories/drone-green-poster.jpg',
    video: '/stories/drone-green.mp4',
    eyebrow: 'Open spaces',
    headline: 'Central greens between the plotted blocks.',
  },
  {
    id: 'drone-park',
    label: 'Parks',
    poster: '/stories/drone-park-poster.jpg',
    video: '/stories/drone-park.mp4',
    eyebrow: 'Everyday life',
    headline: 'Palm-lined park spaces taking shape.',
  },
  {
    id: 'drone-grid',
    label: 'Township grid',
    poster: '/stories/drone-grid-poster.jpg',
    video: '/stories/drone-grid.mp4',
    eyebrow: 'Planned layout',
    headline: 'Straight roads and blocks, seen from above.',
  },
  {
    id: 'drone-gate',
    label: 'Entrance gate',
    poster: '/stories/drone-gate-poster.jpg',
    video: '/stories/drone-gate.mp4',
    eyebrow: 'On ground',
    headline: 'The entrance gate and avenue, standing today.',
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
