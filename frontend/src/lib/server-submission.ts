export type SharedSubmission = {
  id: string;
  slug: string;
  title: string;
  description: string;
  kind: "ONE_OF_ONE" | "TRAIT_EXTENSION";
  categories: string[];
  previewAssetUrl: string;
  upvoteCount: number;
  downvoteCount: number;
  user: {
    displayName: string | null;
    socialAccounts: Array<{ username: string }>;
  };
};

export async function getSharedSubmission(slug: string) {
  const apiUrl = (process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");
  const response = await fetch(`${apiUrl}/api/submissions/${encodeURIComponent(slug)}`, {
    cache: "no-store",
  });
  if (!response.ok) return null;
  const body = await response.json() as { item: SharedSubmission };
  return body.item;
}
