export type ApiPostEventRequestBody = {
  channel: string
  event: string
  data: any
}

export interface JoinToken {
  channel: string
  timestamp: number
  data?: any
}

export interface WebhookRequestBody {
  event: string
}
