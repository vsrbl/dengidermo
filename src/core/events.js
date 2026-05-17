export class EventQueue {
  constructor(limit = 64) {
    this.limit = limit;
    this.items = [];
    this.seq = 0;
  }

  push(event) {
    this.seq += 1;
    this.items.push({ seq: this.seq, ...event });
    if (this.items.length > this.limit) this.items.splice(0, this.items.length - this.limit);
  }

  after(seq) {
    return this.items.filter((event) => event.seq > seq);
  }
}
