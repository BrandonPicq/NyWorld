export class TickCounter {
  private current = 0;

  get tick(): number {
    return this.current;
  }

  advance(): number {
    this.current += 1;
    return this.current;
  }

  restoreTo(tick: number): void {
    this.current = tick;
  }
}
