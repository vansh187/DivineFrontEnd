/** Per-township walkthrough reels. Used on the landing "Now selling" card and
 *  the project detail hero; projects without an entry fall back to a still. */
export const townshipVideoByProject: Record<string, string> = {
  'suraksha-enclave': '/townships/suraksha-enclave.mp4',
  'ops-divine-greens': '/townships/ops-divine.mp4',
};

export function townshipVideoFor(id: string | undefined | null): string | undefined {
  return id ? townshipVideoByProject[id] : undefined;
}
