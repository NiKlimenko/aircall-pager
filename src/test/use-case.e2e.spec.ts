import { expect } from 'chai';
import * as td from 'testdouble';
import { PagerService } from '../services/pager/pager.service';
import { PagerRepository, ServiceAlertState } from '../services/pager/pager.repository';
import {
  EscalationPolicy,
  EscalationPolicyLevelTargetTypes
} from '../dto/escalation-policy.dto';
import { NotificationService } from '../services/notification.service';
import { EmailNotification } from '../dto/notification.dto';
import { TimerService } from '../services/timer.service';


let pager: PagerService;
let mockState: ServiceAlertState = null;
const serviceId = '123';

const mockEscalationPolicy: EscalationPolicy = {
  id: '1',
  name: 'Notify Engineers',
  serviceId,
  levels: [
    {
      id: '1-1',
      escalationPolicyId: '1',
      name: 'Notify DevOps',
      order: 0,
      targets: [
        {
          id: '1-1-1',
          escalationPolicyLevelId: '1-1',
          name: 'Send Email',
          type: EscalationPolicyLevelTargetTypes.Email,
          emails: ['devops@aircall.io'],
        }
      ]
    },
    {
      id: '1-2',
      escalationPolicyId: '1',
      name: 'Notify Engineers',
      order: 1,
      targets: [
        {
          id: '1-2-1',
          escalationPolicyLevelId: '1-1',
          name: 'Send Email',
          type: EscalationPolicyLevelTargetTypes.Email,
          emails: ['engineers@aircall.io'],
        }
      ]
    }
  ]
};

let mockSendNotificationMethod;
let mockSetTimerMethod;
let mockRemoveTimerMethod;

const putServiceInUnhealthyStateAndValidate = async () => {
  const alertId = 'alert-111';
  const alertMessage = '502 gateway timeout';
  await pager.alertEmittedEvent({ serviceId, id: alertId, message: alertMessage });

  // The new state should be created when service becomes unhealthy
  expect(alertId).to.be.eq(mockState.id);
  expect(alertMessage).to.be.eq(mockState.metadata.alertMessage);
  expect(serviceId).to.be.eq(mockState.serviceId);
  expect(mockState.elCounter).to.be.eq(0);
  expect(mockState.isAcknowledged).to.be.false;

  // The Pager notifies all targets of the first level of the escalation policy
  const emailsToNotify = mockEscalationPolicy.levels[0].targets[0].emails;
  const secondLvlEmailsToNotify = mockEscalationPolicy.levels[1].targets[0].emails;
  td.verify(mockSendNotificationMethod(new EmailNotification(emailsToNotify, alertMessage)), { times: 1 });
  td.verify(mockSendNotificationMethod(new EmailNotification(secondLvlEmailsToNotify, alertMessage)), { times: 0 });

  return { alertId, alertMessage };
}

beforeEach('setup mock adapters', () => {
  const repository = new PagerRepository();
  td.replace(repository, 'saveServiceAlertState', (state: ServiceAlertState) => {
    mockState = state;
  });
  td.replace(repository, 'getServiceAlertState', _ => mockState);
  td.replace(repository, 'getEscalationPolicy', _ => mockEscalationPolicy);
  td.replace(repository, 'markServiceAlertAcknowledged', _ => {
    mockState.isAcknowledged = true;
  });
  td.replace(repository, 'markServiceAlertHealthy', _ => {
    mockState = null;
  });

  const notificationService = new NotificationService();
  mockSendNotificationMethod = td.func(notificationService.sendNotification);
  td.replace(notificationService, 'sendNotification', mockSendNotificationMethod);

  const timerService = new TimerService();
  mockSetTimerMethod = td.func(timerService.setTimer);
  td.replace(timerService, 'setTimer', mockSetTimerMethod);

  mockRemoveTimerMethod = td.func(timerService.setTimer);
  td.replace(timerService, 'removeTimer', mockRemoveTimerMethod);

  pager = new PagerService(repository, notificationService, timerService);
});

afterEach('cleanup mock data', () => {
  td.reset();
  mockState = null;
});

it('should notify first level targets and set timer', async () => {
  const currentState = await pager.getServiceState(serviceId);
  // Null state means no active alert for the service
  expect(currentState).to.be.null;

  await putServiceInUnhealthyStateAndValidate();

  // Sets a 15-minutes acknowledgement delay
  td.verify(mockSetTimerMethod(15 * 60 * 1000, serviceId), { times: 1 })
});

it('should notify second level targets and set timer', async () => {
  await putServiceInUnhealthyStateAndValidate();

  await pager.acknowledgementTimeoutEvent({ id: serviceId, timeMs: null });

  // Pager receives the Acknowledgement Timeout and updates state
  const currentState = await pager.getServiceState(serviceId);
  expect(currentState.elCounter).to.be.eq(1);

  // Pager notifies all targets of the second level of the escalation policy
  const secondLvlEmailsToNotify = mockEscalationPolicy.levels[1].targets[0].emails;
  td.verify(mockSendNotificationMethod(
    new EmailNotification(secondLvlEmailsToNotify, currentState.metadata.alertMessage)
  ), { times: 1 });

  // Sets a 15-minutes acknowledgement delay
  td.verify(mockSetTimerMethod(15 * 60 * 1000, serviceId), { times: 2 })
})

it('should notify first level targets and stop after receiving acknowledgement', async () => {
  await putServiceInUnhealthyStateAndValidate();

  await pager.acknowledgeServiceAlert(serviceId);

  const currentState = await pager.getServiceState(serviceId);
  expect(currentState.isAcknowledged).to.be.true;
  td.verify(mockRemoveTimerMethod(serviceId), { times: 1 });

  // Pager receives the Acknowledgement Timeout, but ignore it
  await pager.acknowledgementTimeoutEvent({ id: serviceId, timeMs: null });
  expect(currentState.elCounter).to.be.eq(0);

  // Pager doesn't notify any targets of the second level of the escalation policy
  const secondLvlEmailsToNotify = mockEscalationPolicy.levels[1].targets[0].emails;
  td.verify(mockSendNotificationMethod(
    new EmailNotification(secondLvlEmailsToNotify, currentState.metadata.alertMessage)
  ), { times: 0 });

  // Doesn't set a 15-minutes acknowledgement delay again
  td.verify(mockSetTimerMethod(15 * 60 * 1000, serviceId), { times: 1 });
})

it('should not notify any targets after new alert arrives for unhealthy service', async () => {
  const { alertMessage, alertId } = await putServiceInUnhealthyStateAndValidate();

  const message = '503 Service Unavailable';
  await pager.alertEmittedEvent({ serviceId, id: 'alert-222', message });

  // Second alert should be ignored
  expect(alertId).to.be.eq(mockState.id);
  expect(alertMessage).to.be.eq(mockState.metadata.alertMessage);

  // Pager doesn't notify any targets of the second level of the escalation policy
  const secondLvlEmailsToNotify = mockEscalationPolicy.levels[1].targets[0].emails;
  td.verify(mockSendNotificationMethod(new EmailNotification(secondLvlEmailsToNotify, message )), { times: 0 });

  // Doesn't set a 15-minutes acknowledgement delay again
  td.verify(mockSetTimerMethod(15 * 60 * 1000, serviceId), { times: 1 });
})

it('should notify first level targets and stop after becoming healthy', async () => {
  const { alertMessage } = await putServiceInUnhealthyStateAndValidate();

  await pager.markServiceHealthy(serviceId);

  const currentState = await pager.getServiceState(serviceId);
  // Null state means no active alert for the service
  expect(currentState).to.be.null;

  td.verify(mockRemoveTimerMethod(serviceId), { times: 1 });

  // Pager receives the Acknowledgement Timeout, but ignore it
  await pager.acknowledgementTimeoutEvent({ id: serviceId, timeMs: null });
  expect(currentState).to.be.null;

  // Pager doesn't notify any targets of the second level of the escalation policy
  const secondLvlEmailsToNotify = mockEscalationPolicy.levels[1].targets[0].emails;
  td.verify(mockSendNotificationMethod(new EmailNotification(secondLvlEmailsToNotify, alertMessage)), { times: 0 });

  // Doesn't set a 15-minutes acknowledgement delay again
  td.verify(mockSetTimerMethod(15 * 60 * 1000, serviceId), { times: 1 });
})
