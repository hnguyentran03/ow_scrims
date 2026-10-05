/**
 * A sliding window of event timestamps: at most `limit` takes inside any `windowMs`
 * span. Process-local and tiny — one box, one Node process, so a shared store would
 * buy nothing. A refused take is not recorded, so being throttled never extends the
 * throttle.
 */
export class RateWindow {
  private readonly stamps: number[] = [];

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  /** Records a take and returns true, or returns false when the window is already full. */
  tryTake(): boolean {
    const t = this.now();
    const cutoff = t - this.windowMs;
    while (this.stamps.length > 0 && this.stamps[0] <= cutoff) this.stamps.shift();
    if (this.stamps.length >= this.limit) return false;
    this.stamps.push(t);
    return true;
  }

  /** Takes still inside the window as of the last call. For tests. */
  get size(): number {
    return this.stamps.length;
  }
}
