import {Server, Socket} from 'socket.io'
import {_debug} from './lib/helpers'
import {createClient} from 'redis'
import {createAdapter} from '@socket.io/redis-adapter'
import express, {Request, Response} from 'express'
import http from 'http'
import path from 'path'
import ApiRoutes from './lib/routes/api'
import ChannelHandler from './lib/socket/channel'
import {URL} from 'url'

const app = express()
const server = http.createServer(app)

const io = new Server(server, {
  cors: {
    origin: (requestOrigin: string | undefined, callback: (err: any, origin?: any) => void) => {
      if (!requestOrigin) {
        callback(null, true)
        return
      }

      const originUrl = new URL(requestOrigin)
      _debug('io cors hostname', originUrl.hostname)
      if (!originUrl.hostname.endsWith('localhost')) {
        callback(new Error('Invalid origin'), 'localhost')

        return
      }

      callback(null, requestOrigin)
    },
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'User-Agent', 'X-Requested-With', 'Content-Length'],
  },
  allowRequest: (req: http.IncomingMessage, callback: (err: any, success: boolean) => void) => {
    const origin = req.headers.origin;
    if (!origin) {
      callback(null, true)
      return
    }

    const url = new URL(origin)
    callback(null, url.hostname.endsWith('localhost'))
  },
});

const redisHost = process.env.REDIS_HOST as string
const redisPort = process.env.REDIS_PORT || 6379
const httpApiKey = process.env.HTTP_API_KEY as string

_debug(`redis://${redisHost}:${redisPort}`)

app.use(
  express.json({
    strict: true,
  })
)
app.use((req: Request, res: Response, next: () => void) => {
  const apiKey = req.headers['x-api-key']
  if (req.path.indexOf('/api') === 0 && (!apiKey || apiKey !== httpApiKey)) {
    return res.status(400).json({
      status: 'error',
      code: 'invalid_api_key',
      message: 'Invalid api key',
    })
  }

  req.app.set('PAGE_TIME', Date.now() / 1000)

  next()
})
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use(function (err: any, _req: Request, res: Response, _next: () => void) {
  _debug(err.stack)
  res.status(500).json({
    status: 'error',
    code: 'internal_server_error',
    message: 'Internal Server Error',
  })
})
app.use('/api', ApiRoutes)

if (process.env.NODE_ENV !== 'production') {
  app.get('/', function (_req: Request, res: Response) {
    res.sendFile(path.join(__dirname, 'pages', 'index.html'))
  })
}

const pubClient = createClient({
  url: `redis://${redisHost}:${redisPort}`,
  prefix: process.env.REDIS_DATA_PREFIX,
  password: process.env.REDIS_AUTH_PASSWORD,
})

const subClient = pubClient.duplicate()
io.adapter(createAdapter(pubClient, subClient))

const db = pubClient.duplicate()

io.on('connection', (socket: Socket) => {
  const channel = new ChannelHandler(socket, db)
  channel.handle()
})

io.of('/').adapter.on('join-room', (room: string) => {
  const clientIds = io.of('/').adapter.rooms.get(room)
  
  if (clientIds) {
    io.to(room).emit('user-total', clientIds.size)
  }
})
io.of('/').adapter.on('leave-room', (room: string) => {
  const clientIds = io.of('/').adapter.rooms.get(room)
  if (clientIds) {
    io.to(room).emit('user-total', clientIds.size)
  }
})

process.on('uncaughtException', (err) => {
  _debug('uncaughtException', err)
  _debug('app crashed. Close all redis connections')

  pubClient.end(true)
  subClient.end(true)
  db.end(true)

  _debug('process.exit(1)')
  process.exit(1)
})

server.listen(3000, () => {
  _debug(`App started: http://localhost:3000`)
})
