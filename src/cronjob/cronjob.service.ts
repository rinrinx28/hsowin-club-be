import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron } from '@nestjs/schedule';

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

  @Cron('0 */3 * * * *')
  handleServerAuto() {
    this.eventEmitter.emit('server-24', 'isRun');
  }
}
