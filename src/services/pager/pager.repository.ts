import { EscalationPolicy } from "../../dto/escalation-policy.dto";

export class ServiceAlertState {
  id: string;
  serviceId: string;
  elCounter: number;
  isAcknowledged: boolean;
  metadata: {
    alertMessage: string;
  };
  // Optimistic locking
  version?: number;

  constructor(alertId: string, serviceId: string, elCounter: number, isAcknowledged: boolean,
              alertMessage: string) {

    this.id = alertId;
    this.serviceId = serviceId;
    this.elCounter = elCounter;
    this.isAcknowledged = isAcknowledged;
    this.metadata = {
      alertMessage,
    }
  }
}

export class PagerRepository {
  /**
   * Receives EP for a given service
   * NOTE: Updated eventually
   * @param serviceId
   */
  async getEscalationPolicy(serviceId: string): Promise<EscalationPolicy> {
    // Get object from DB
    return new EscalationPolicy();
  }

  /**
   * Updates EP for a given service
   * @param escalationPolicy
   */
  async saveEscalationPolicy(escalationPolicy: EscalationPolicy) {
    // Transforms object and saves into DB
  }

  /**
   * Receives current state of the given service
   * @param serviceId
   */
  async getServiceAlertState(serviceId: string): Promise<ServiceAlertState|null> {
    // Get object from DB
    return null;
  }

  /**
   * Updates service's state
   * @param state
   */
  async saveServiceAlertState(state: ServiceAlertState): Promise<ServiceAlertState> {
    // Updates the state in DB
    return state;
  }

  /**
   * Deletes service's state
   * @param serviceId
   */
  async markServiceAlertHealthy(serviceId: string) {
    // Deletes state record from DB
  }

  /**
   * Mark service's alert as acknowledged
   * @param serviceId
   */
  async markServiceAlertAcknowledged(serviceId: string) {
    // Updates property isAcknowledged = true in DB
  }
}
