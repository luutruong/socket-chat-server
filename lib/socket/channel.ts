import {Socket} from 'socket.io'
import {JoinToken, WebhookRequestBody} from '../..'
import {_debug, fetchTimeout, oneTimeToken} from '../helpers'
import CryptoJS from 'crypto-js'
import { RedisClient } from 'redis'
import _ from 'lodash'

class ChannelHandler {
  private socket: Socket
  private redis: RedisClient

  constructor(socket: Socket, redis: RedisClient) {
    this.socket = socket
    this.redis = redis
  }

  public handle(): void {
    _debug('ChannelManager.handle()')

    this.socket.on('join', this.handleJoin.bind(this))

    // internal events
    const httpApiKey = process.env.HTTP_API_KEY as string
    this.socket.on(`${httpApiKey}-events`, this.handleEvents.bind(this))

    this.socket.on('disconnecting', this.onDisconnecting.bind(this))
  }

  private async onDisconnecting(): Promise<void> {
    _debug('onDisconnecting', this.socket.rooms)

    this.redis.get(this.socket.id, async (err, reply) => {
      if (err) {
        return
      }

      if (!reply) {
        this.redis.del(this.socket.id)
        return
      }

      const json: JoinToken = JSON.parse(reply)
      if (_.has(json.data, 'webhook_url')) {
        _debug('  -> found webhook url', json.data.webhook_url)
        if (json.data.webhook_url.length > 0) {
          _debug('  ->', 'call webhook')
          const now = Date.now()

          try {
            const webhookBody: WebhookRequestBody = {
              event: 'disconnect'
            }

            const response = await fetchTimeout(json.data.webhook_url, {
              method: 'POST',
              body: oneTimeToken(webhookBody, process.env.HTTP_API_KEY as string),
            })

            _debug('  ->', json.data.webhook_url, '->', response.statusText, '->', Date.now() - now, 'ms')
          } catch (e) {
            _debug('  ->', e)
          }
        }
      }

      this.redis.del(this.socket.id)
    })
  }

  private handleJoin(joinToken: string): void {
    if (!joinToken) {
      return
    }

    _debug('handleJoin', {joinToken})

    const base64 = CryptoJS.enc.Base64.parse(joinToken)
    let str
    try {
      str = CryptoJS.enc.Utf8.stringify(base64)
    } catch (e) {
      //
    }

    if (!str || str.length <= 32) {
      _debug('  -> invalid token')
      return
    }

    const len = str.length
    const jsonEncoded = str.substring(0, len - 32)
    const md5 = str.substring(len - 32)

    const computeHash = CryptoJS.MD5(jsonEncoded + (process.env.HTTP_API_KEY as string)).toString()
    if (computeHash !== md5) {
      _debug('  -> invalid signature')
      return
    }

    const json: JoinToken = JSON.parse(jsonEncoded)
    _debug('  ->', json)

    const now = Math.floor(Date.now() / 1000)
    if (json.timestamp <= now) {
      _debug('  -> token expired')
      return
    }

    this.redis.set(this.socket.id, JSON.stringify(json))
    this.socket.join(json.channel)
  }

  private handleEvents(channelId: string, event: string, data: any): void {
    _debug('handleEvents', {channelId, event, data})
    this.socket.to(channelId).emit(event, data)
  }
}

export default ChannelHandler
