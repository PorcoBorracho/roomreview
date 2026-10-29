export type MediaItem = { id: string; url: string };

export type AdminSubmission = {
  id: string;
  username: string;
  email: string;
  country: string;
  description: string;
  status: "pending" | "approved";
  submittedAt: string;
  media: MediaItem[];
};

export type DeckSubmission = {
  id: string;
  username: string;
  country: string;
  description: string;
  submittedAt: string;
  media: MediaItem[];
};
