// @flow

import {readFileSync} from 'fs';
import {join} from 'path';

import Op, {Frame} from 'swarm-ron';
import UUID, {ZERO} from 'swarm-ron-uuid';
import type {Connection as IConn} from '../../client/src';

export class Connection implements IConn {
  fixtures: Array<RawFrame>;
  session: Array<RawFrame>;
  onmessage: (ev: MessageEvent) => any;
  onopen: (ev: Event) => any;
  readyState: number;

  constructor(fixtures: ?string) {
    this.fixtures = [];
    this.session = [];
    if (fixtures) {
      const content = readFileSync(join(__dirname, fixtures), 'utf8');
      for (const chunk of content.split('.\n')) {
        if (!chunk.trim()) continue;
        const frame = new Frame(chunk);
        for (const op of frame) {
          if (op.isComment() && op.source) {
            // $FlowFixMe
            this.fixtures.push(new RawFrame(frame.body.slice(op.source.length), op.value(0)));
          } else {
            throw new Error('unexpected op');
          }
          break;
        }
      }
    }
    setTimeout(() => {
      if (this.onopen) this.onopen(new Event(''));
      this.pushPending();
    }, 0);
  }

  dump(): {fixtures: Array<RawFrame>, session: Array<RawFrame>} {
    return {
      fixtures: this.fixtures,
      session: this.session,
    };
  }

  send(payload: string): void {
    // setTimeout(() => {
    this.session.push(new RawFrame(payload, '>'));
    this.pushPending();
    // }, 0);
  }

  pushPending(): void {
    let i = 0;
    for (const raw of this.fixtures.slice(this.session.length)) {
      i++;
      if (raw.direction === '<') {
        (raw => {
          setTimeout(() => {
            // console.log(`session.push('${raw.toString()}')`);
            this.session.push(raw);
            this.onmessage((({data: raw.body}: any): MessageEvent));
            // console.log('message was sent');
          }, 100 << i);
        })(raw);
      } else break;
    }
  }
}

test('connection', () => {
  const conn = new Connection('001-conn.ron');
  const dump = conn.dump();
  expect(JSON.stringify(dump.fixtures)).toBe(
    "[\"*~ '>' *db#test@0+user?!:password'12345'.\"," +
      '"*~ \'<\' *db#test$server@1ABC+user:1ABC+server!.",' +
      '"*~ \'>\' #object?.",' +
      "\"*~ '<' *lww#object@time+author!:key'value'.\"]",
  );
  expect(dump.fixtures[0].direction).toBe('>');
});

class RawFrame {
  direction: string;
  body: string;

  constructor(body: string, direction: string) {
    this.body = body;
    this.direction = direction;
  }

  toString(): string {
    return `*~ '${this.direction}' ${this.body}.`;
  }

  toJSON(): string {
    return this.toString();
  }
}
