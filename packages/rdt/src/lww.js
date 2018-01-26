// @flow
'use strict';

import Op, {Frame, Batch, FRAME_SEP} from 'swarm-ron';
import UUID, {ZERO} from 'swarm-ron-uuid';
import IHeap, {refComparator, eventComparatorDesc} from './iheap';

const DELTA = UUID.fromString('d');
const heap = new IHeap(refComparator, eventComparatorDesc);

// Last-write-wins reducer.
export function reduce(batch: Batch): Frame {
  const ret = new Frame();
  if (!batch.length) return ret;

  for (const frame of batch) {
    if (batch.length === 1) return frame;
    for (const op of frame) {
      const head = new Op(type, op.uuid(1), op.uuid(2), op.uuid(3), undefined, FRAME_SEP);
      const theLastOne = Op.fromString(batch.frames[batch.length - 1].toString());
      if (theLastOne) head.event = theLastOne.event;
      if (op.isHeader() && op.uuid(3).isZero()) {
        head.location = ZERO;
      } else {
        head.location = DELTA;
      }
      ret.push(head);
      heap.clear();
      heap.put(batch);

      while (!heap.eof()) {
        const current = heap.current();
        if (!current) break;
        ret.pushWithTerm(current, ',');
        heap.nextPrim();
      }
      return ret;
    }
  }

  return ret;
}

export const type = UUID.fromString('lww');

export default {reduce, type};
