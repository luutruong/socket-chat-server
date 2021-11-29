# Socket Chat Server

## Environments

| Name | Type | Description |
| --- | --- | --- |
| HTTP_API_KEY | string | Key to secure API requests |
| REDIS_HOST | string | Redis host to connect. If you want to use external redis put host here |
| REDIS_PORT | number | Redis port |
| REDIS_DATA_PREFIX | string | Redis data prefix |
| REDIS_AUTH_PASSWORD | string | Password to connect redis |
| ALLOW_REQUEST_DOMAINS | string | Only accept requests certain domains. Eg: `foo.com, bar.me` |

## Installation

Clone this repo to your working space then run the following command:

```bash
docker-compose up -d
```

## Reference

### POST `/api/socket/events`

App server asks socket server to broadcast an event to a specified channel.

Headers:

- `Content-Type` must be `application/json`
- `X-Api-Key`

```typescript
interface RequestBody {
  channel: string
  event: string
  data?: any
}

interface ResponseBody {
  status: string
}
```

Example:

```bash
curl --location --request POST 'http://localhost:3000/api/socket/events' \
--header 'Content-Type: application/json' \
--header 'X-Api-Key: test-api-key' \
--data-raw '{"channel":"test-123","event":"join-channel","data":{"user_id":1}}'
```

## Connect to server

Client connects to socket server and joins a channel.

```js

import {io} from 'socket.io-client'

const socket = io('http://localhost:3000', {
  reconnectionAttempts: 10,
  reconnectionDelay: 3000, // attempt re-connect every 3 seconds
})

socket.emit("join", joinToken)

```

### Join Token

The token is a base64 encoded json object, appended with a md5 signature.
This should be calculated by a backend server to protect the api key.

```typescript
interface JoinToken {
  channel: string
  timestamp: number
  data: {
    webhook_url?: string
  } | any
}

function generateJoinToken(channel: string, data: any, apiKey: string) {
  const timestamp = Math.floor(Date.now() / 1000) + 60 // expires in 1 minute
  const json = JSON.stringify({ channel, timestamp, data })
  const str = json + CryptoJS.MD5(json + apiKey).toString()
  return CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(str))
}
```
