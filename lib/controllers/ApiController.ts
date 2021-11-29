import {Request, Response} from 'express'
import _ from 'lodash'
import {io} from 'socket.io-client'
import {ApiPostEventRequestBody} from '../..'

class ApiController {
  public static index(_req: Request, res: Response): void {
    res.status(200).json({
      status: 'ok',
    })
  }

  public static postEvents(req: Request, res: Response): void {
    const body: ApiPostEventRequestBody = req.body
    if (!_.isString(body.channel) || !body.channel) {
      return this.jsonError(res, 'invalid_channel', 'Invalid channel')
    }
    if (!_.isString(body.event) || !body.event) {
      return this.jsonError(res, 'invalid_event', 'Invalid event')
    }

    const socket = io('http://localhost:3000', {
      transports: ['websocket'],
    })
    const httpApiKey = process.env.HTTP_API_KEY as string
    socket.on('connect', () => {
      socket.emit(`${httpApiKey}-events`, body.channel, body.event, body.data)

      setTimeout(function () {
        socket.disconnect()
      }, 500)

      res.status(200).json({
        status: 'ok',
        timing: Date.now() / 1000 - req.app.get('PAGE_TIME'),
      })
    })

    socket.io.on('error', (err) => {
      this.jsonError(res, 'socket_error', err.message)
    })
  }

  protected static jsonError(res: Response, code: string, message: string): void {
    res.status(200).json({
      status: 'error',
      message,
      code,
      timing: Date.now() / 1000 - res.app.get('PAGE_TIME'),
    })
  }
}

export default ApiController
