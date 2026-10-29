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

export type Board = {
  id: string;
  slug: string;
  streamerName: string;
  platform: import("./platforms").Platform;
  title: string;
  description: string;
  isActive: boolean;
  submissionsOpen: boolean;
  peopleAllowed: boolean;
  createdAt: string;
  updatedAt: string;
  hasStreamerPassword: boolean;
  hasModeratorPassword: boolean;
  ownerId: string | null;
  ownerName: string | null;
  /** Admins con los que se ha compartido */
  members: { id: string; username: string }[];
};

export type BoardWithStats = Board & { pending: number; approved: number };

/** Lo mínimo que necesitan las vistas de un board */
export type BoardInfo = Pick<Board, "id" | "slug" | "streamerName" | "platform" | "title" | "description" | "isActive" | "submissionsOpen" | "peopleAllowed">;
