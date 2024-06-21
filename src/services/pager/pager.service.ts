import { ServiceAlert } from "../../dto/alert.dto";
import { EscalationPolicy, EscalationPolicyLevel, EscalationPolicyLevelTargetTypes } from "../../dto/escalation-policy.dto";
import { EmailNotification, SMSNotification } from "../../dto/notification.dto";
import { NotificationService } from "../notification.service";
import { TimerPayload, TimerService } from "../timer.service";
import { PagerRepository, ServiceAlertState } from "./pager.repository";

export class PagerService {
  // Will be injected by DI
  constructor(
    private repository: PagerRepository = new PagerRepository(),
    private notificationService: NotificationService = new NotificationService(),
    private timerService: TimerService = new TimerService(),
  ) {}

  /**
   * API which can be invoked from frontend
   * Can be used for displaying the state of the service
   */
  async getServiceState(serviceId: string) {
    return this.repository.getServiceAlertState(serviceId);
  }

  /**
   * API which can be invoked from frontend
   * Updates the state of the service, stops any further escalation
   */
  async acknowledgeServiceAlert(serviceId: string) {
    await this.repository.markServiceAlertAcknowledged(serviceId);
    await this.timerService.removeTimer(serviceId);
  }

  /**
   * API which can be invoked from frontend
   * Recovers the state of the service, stops further escalation for this alert
   */
  async markServiceHealthy(serviceId: string) {
    await this.repository.markServiceAlertHealthy(serviceId);
    await this.timerService.removeTimer(serviceId);
  }

  /**
   * Method invoked by Queue processor
   * Auto updates the state of EP managed by another service
   */
  async escalationPolicyChangedEvent(escalationPolicy: EscalationPolicy) {
    await this.repository.saveEscalationPolicy(escalationPolicy);
  }

  /**
   * Method invoked by Queue processor
   * Auto updates the state of EP managed by another service
   */
  async escalationPolicyDeletedEvent(escalationPolicy: EscalationPolicy) {
    await this.repository.deleteEscalationPolicy(escalationPolicy);
  }

  /**
   * Method invoked by Queue processor
   * Called when the set timer expires
   */
  async acknowledgementTimeoutEvent(event: TimerPayload) {
    const serviceState = await this.repository.getServiceAlertState(event.id);
    if (!serviceState || serviceState.isAcknowledged) {
      // Service already in a healthy state or handled
      return;
    }

    // Escalating alert
    serviceState.elCounter += 1;

    const transaction = async () => {
      await this.repository.saveServiceAlertState(serviceState);
      await this.escalateServiceOnLevel(serviceState.serviceId, serviceState.elCounter, event.payload.message);
    }

    // Transaction implementation
    await transaction();
  }

  /**
   * Method invoked by Queue processor
   * Called when new Alert arrives
   */
  async alertEmittedEvent(alert: ServiceAlert) {
    const serviceState = await this.repository.getServiceAlertState(alert.serviceId);
    if (serviceState) {
      // Don't process already registered alerts from the same service
      return;
    }

    const escalationLvl = 0;
    const newState = new ServiceAlertState(alert.id, alert.serviceId, escalationLvl, false,
      alert.message);

    const transaction = async () => {
      await this.repository.saveServiceAlertState(newState);
      await this.escalateServiceOnLevel(newState.serviceId, escalationLvl, newState.metadata.alertMessage);
    };

    // Transaction implementation
    await transaction();
  }

  /**
   * Performs steps for Alert escalating
   * @param serviceId
   * @param lvl
   * @param message
   * @private
   */
  private async escalateServiceOnLevel(serviceId: string, lvl: number, message: string) {
    const escalationPolicy = await this.repository.getEscalationPolicy(serviceId);

    await this.sendNotification(escalationPolicy.levels[lvl], message);

    const timerDurationMs = 15 * 60 * 1000;
    await this.timerService.setTimer(timerDurationMs, serviceId);
  }

  /**
   * Sends message to appropriate target
   * @param escalationPolicyLvl
   * @param message
   * @private
   */
  private async sendNotification(escalationPolicyLvl: EscalationPolicyLevel, message: string) {
    const notificationsToSend = escalationPolicyLvl.targets.map(target => {
      if (EscalationPolicyLevelTargetTypes.Email === target.type && target.emails?.length) {
        return new EmailNotification(target.emails, message);
      } else if (EscalationPolicyLevelTargetTypes.SMS === target.type && target.phoneNumbers?.length) {
        return new SMSNotification(target.phoneNumbers, message);
      }
    }).map(notification => notification && this.notificationService.sendNotification(notification));

    return Promise.all(notificationsToSend);
  }
}
