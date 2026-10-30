export type MediaKind = "image" | "video";
export type MediaItem = { id: string; url: string; kind: MediaKind };

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

/** Streamer (cuenta de Twitch) tal como se muestra */
export type StreamerRef = {
  id: string;
  /** Login de Twitch: su dirección en la web (/{login}) */
  login: string;
  displayName: string;
  avatarUrl: string | null;
  /** active: aprobado · pending: esperando aprobación · suspended: suspendido */
  status: "active" | "pending" | "suspended";
};

export type Board = {
  id: string;
  slug: string;
  /** null en boards de versiones anteriores que aún no tienen streamer */
  streamer: StreamerRef | null;
  title: string;
  description: string;
  isActive: boolean;
  submissionsOpen: boolean;
  peopleAllowed: boolean;
  /** Deck: cada review nueva empieza difuminada */
  blurNew: boolean;
  /** Se puede enviar un vídeo */
  allowVideos: boolean;
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
export type BoardInfo = Pick<
  Board,
  "id" | "slug" | "streamer" | "title" | "description" | "isActive" | "submissionsOpen" | "peopleAllowed" | "blurNew" | "allowVideos"
>;

/** Dirección del board: /{streamer}/{board}, o null si aún no tiene streamer */
export const boardHref = (b: Pick<Board, "slug" | "streamer">) => (b.streamer ? `/${b.streamer.login}/${b.slug}` : null);
