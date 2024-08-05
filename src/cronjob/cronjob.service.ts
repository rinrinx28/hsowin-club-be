import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron } from '@nestjs/schedule';
// import seedrandom from 'seedrandom';

@Injectable()
export class CronjobService {
  constructor(private eventEmitter: EventEmitter2) {}
  private job = new Map();

  create(sessionId, timeOutId) {
    this.job.set(sessionId, timeOutId);
    return true;
  }
  remove(sessionId) {
    const timeOutId = this.job.get(sessionId);
    if (timeOutId) {
      clearTimeout(timeOutId);
      return true;
    } else {
      return false;
    }
  }

  @Cron('0 */1 * * * *')
  handleServerAuto() {
    // this.eventEmitter.emit('server-24', 'isRun');
  }

  @Cron('0 0 0 * * *', {
    name: 'Reset Rank Days',
  })
  handleRankDay() {
    // this.eventEmitter.emit('rank-days', 'isrun');
  }
  @Cron('0 35 * * * *', {
    name: 'Reset Rank Clans',
  })
  handleRankClans() {
    // this.eventEmitter.emit('rank-clans', 'isrun');
  }

  @Cron('* * * * * *')
  handleTest() {
    // let now = Date.now();
    // let rng = seedrandom('hello.');
    // console.log(rng());
  }
}
