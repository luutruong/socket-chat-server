import fetch from 'isomorphic-unfetch'
import unfetch from 'isomorphic-unfetch'
import CryptoJS from 'crypto-js'

export function _debug(...args: any[]): void {
  console.log(`[${new Date().toLocaleString()}]`, ...args)
}

export async function fetchTimeout(
  url: string,
  options: {[key: string]: any},
  timeout = 10000
): Promise<unfetch.IsomorphicResponse> {
  return new Promise((resolve, reject) => {
    fetch(url, options).then(resolve, reject)

    if (timeout > 0) {
      setTimeout(reject, timeout, new Error('Connection time out'))
    }
  })
}

export function oneTimeToken(data: any, key: string): string {
  const timestamp = Math.floor(Date.now() / 1000) + 60

  const payload = {
    data,
    timestamp
  }
  const json = JSON.stringify(payload)

  const str = json + CryptoJS.MD5(json + key).toString()
  return CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(str))
}
