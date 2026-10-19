export type BoardRow = { fid: number; username: string; score: number; playedAt?: string | { seconds: number } };
export type ScoreSubmission = Pick<BoardRow, "fid" | "username" | "score">;
