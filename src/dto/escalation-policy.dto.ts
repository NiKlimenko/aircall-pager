import { BaseDto } from "./base.dto";

export class EscalationPolicy extends BaseDto {
  name: string;
  serviceId: string;
  levels: EscalationPolicyLevel[];
}

export class EscalationPolicyLevel extends BaseDto {
  escalationPolicyId: string;
  name: string;
  order: number;
  targets: EscalationPolicyLevelTarget[];
}

export enum EscalationPolicyLevelTargetTypes {
  Email = 'EMAIL',
  SMS = 'SMS',
}

export class EscalationPolicyLevelTarget extends BaseDto {
  escalationPolicyLevelId: string;
  name: string;
  type: EscalationPolicyLevelTargetTypes;
  emails?: string[];
  phoneNumbers?: string[];
}
