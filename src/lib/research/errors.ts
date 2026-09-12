/** Public error codes deliberately exclude response bodies, credentials and URLs. */
export class ResearchFetchError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number | null = null,
    public readonly retryAfterMs: number | null = null,
  ) {
    super(code);
    this.name = "ResearchFetchError";
  }
}
