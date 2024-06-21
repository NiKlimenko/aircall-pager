export class TimerPayload {
  id: string;
  timeMs: number;
  payload?: {
    //TODO should be generic
    message?: string;
  };
}

export class TimerService {
  /**
   * Send command to set a new timer
   * @param timeMs – timer emits an event after specified time in ms
   * @param timerId – identifier to distinguish and manage timers
   * @param payload – any meta data to receive bac together with event
   */
  async setTimer(timeMs: number, timerId: string, payload?: {}) {}

  /**
   * Send command to cancel Timer.
   * NOTE: it doesn't guarantee that timer will not emit an event
   * @param timerId
   */
  async removeTimer(timerId: string) {}
}
