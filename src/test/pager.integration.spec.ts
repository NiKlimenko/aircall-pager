import * as chai from 'chai';
import * as td from 'testdouble';
import { PagerService } from '../services/pager/pager.service';
import { TimerService } from '../services/timer.service';
import { PagerRepository } from '../services/pager/pager.repository';
import { NotificationService } from '../services/notification.service';
import { verify } from 'testdouble';
import chaiAsPromised from 'chai-as-promised';

chai.use(chaiAsPromised);
const { expect } = chai;


const serviceId = '123';
let pager: PagerService;
let mockRemoveTimerMethod;
let mockMarkServiceAlertAcknowledged;
let mockMarkServiceAlertHealthy;

beforeEach('setup mock Pager', () => {
  const repository = new PagerRepository();
  mockMarkServiceAlertAcknowledged = td.func(repository.markServiceAlertAcknowledged);
  td.replace(repository, 'markServiceAlertAcknowledged', mockMarkServiceAlertAcknowledged);

  mockMarkServiceAlertHealthy = td.func(repository.markServiceAlertHealthy);
  td.replace(repository, 'markServiceAlertHealthy', mockMarkServiceAlertHealthy);

  const notificationService = new NotificationService();

  const timerService = new TimerService();
  mockRemoveTimerMethod = td.func(timerService.setTimer);
  td.replace(timerService, 'removeTimer', mockRemoveTimerMethod);

  pager = new PagerService(repository, notificationService, timerService);
})

afterEach('cleanup mock data', () => {
  td.reset();
});

it('should cancel timer and mark alert as acknowledged', async () => {
  await pager.acknowledgeServiceAlert(serviceId);

  verify(mockRemoveTimerMethod(serviceId), { times: 1 });
  verify(mockMarkServiceAlertAcknowledged(serviceId), { times: 1 });
})

it('should cancel timer and mark alert as healthy', async () => {
  await pager.markServiceHealthy(serviceId);

  verify(mockRemoveTimerMethod(serviceId), { times: 1 });
  verify(mockMarkServiceAlertHealthy(serviceId), { times: 1 });
})

it('should throw exception after new alert arrives for server without EP', async () => {
  const emittedEvent = pager.alertEmittedEvent({ serviceId, id: 'alert-111', message: 'Unexpected error' });
  expect(emittedEvent).eventually.throw
})
