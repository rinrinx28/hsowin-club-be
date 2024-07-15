import { Injectable } from '@nestjs/common';

@Injectable()
export class CronjobService {
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
}
