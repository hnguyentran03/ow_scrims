export class ParseError extends Error {
  readonly line: number | null;
  readonly reason: string;

  constructor(reason: string, line: number | null = null) {
    super(line === null ? reason : `line ${line}: ${reason}`);
    this.name = "ParseError";
    this.line = line;
    this.reason = reason;
  }
}
