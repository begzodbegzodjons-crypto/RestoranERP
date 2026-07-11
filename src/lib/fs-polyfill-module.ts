// Fake fs module - Cloudflare Workers uchun
// ============================================================================
// Bu modul webpack orqali 'fs' va 'node:fs' importlariga yo'naltiriladi.
// Prisma'ning binaryTarget detection logic'i fs.readdir/readdirSync/existsSync
// chaqiradi - bu funksiyalar bo'sh array/false qaytaradi.
//
// Prisma driver adapter ishlatganda engine kerak emas, shuning uchun bu safe.

// Fake readdir - async (path, options, cb) yoki (path, cb) yoki (path, options) -> Promise
export function readdir(_path: string, optionsOrCb?: any, cb?: any): any {
  // (path, cb) format
  if (typeof optionsOrCb === 'function') {
    optionsOrCb(null, [])
    return undefined
  }
  // (path, options, cb) format
  if (typeof cb === 'function') {
    cb(null, [])
    return undefined
  }
  // (path, options?) -> Promise
  return Promise.resolve([])
}

export function readdirSync(_path: string, _options?: any): string[] {
  return []
}

export function existsSync(_path: string): boolean {
  return false
}

export function readFile(_path: string, optionsOrCb?: any, cb?: any): any {
  const callback = typeof optionsOrCb === 'function' ? optionsOrCb : cb
  const err = new Error('File not found in polyfill')
  if (callback) {
    callback(err)
    return undefined
  }
  return Promise.reject(err)
}

export function readFileSync(_path: string, _options?: any): string {
  throw new Error('File not found in polyfill')
}

export function stat(_path: string, optionsOrCb?: any, cb?: any): any {
  const callback = typeof optionsOrCb === 'function' ? optionsOrCb : cb
  const err = new Error('File not found in polyfill')
  if (callback) {
    callback(err)
    return undefined
  }
  return Promise.reject(err)
}

export function statSync(_path: string): { isFile: () => false; isDirectory: () => false } {
  return {
    isFile: () => false,
    isDirectory: () => false,
  }
}

export function writeFile(_path: string, _data: any, optionsOrCb?: any, cb?: any): any {
  const callback = typeof optionsOrCb === 'function' ? optionsOrCb : cb
  if (callback) callback(null)
  return Promise.resolve()
}

export function writeFileSync(_path: string, _data: any, _options?: any): void {}

export function mkdir(_path: string, optionsOrCb?: any, cb?: any): any {
  const callback = typeof optionsOrCb === 'function' ? optionsOrCb : cb
  if (callback) callback(null)
  return Promise.resolve()
}

export function mkdirSync(_path: string, _options?: any): void {}

export function unlink(_path: string, cb?: any): any {
  if (cb) cb(null)
  return Promise.resolve()
}

export function unlinkSync(_path: string): void {}

export function access(_path: string, modeOrCb?: any, cb?: any): any {
  const callback = typeof modeOrCb === 'function' ? modeOrCb : cb
  const err = new Error('File not found in polyfill')
  if (callback) {
    callback(err)
    return undefined
  }
  return Promise.reject(err)
}

export function accessSync(_path: string, _mode?: any): void {
  throw new Error('File not found in polyfill')
}

export function createReadStream(_path: string, _options?: any): any {
  return {
    on: () => this,
    pipe: () => this,
    destroy: () => {},
  }
}

export function createWriteStream(_path: string, _options?: any): any {
  return {
    on: () => this,
    write: () => true,
    end: () => {},
    destroy: () => {},
  }
}

export function lstat(_path: string, optionsOrCb?: any, cb?: any): any {
  const callback = typeof optionsOrCb === 'function' ? optionsOrCb : cb
  const err = new Error('File not found in polyfill')
  if (callback) {
    callback(err)
    return undefined
  }
  return Promise.reject(err)
}

export function lstatSync(_path: string): any {
  return {
    isFile: () => false,
    isDirectory: () => false,
    isSymbolicLink: () => false,
  }
}

export function realpath(_path: string, optionsOrCb?: any, cb?: any): any {
  const callback = typeof optionsOrCb === 'function' ? optionsOrCb : cb
  if (callback) {
    callback(null, _path)
    return undefined
  }
  return Promise.resolve(_path)
}

export function realpathSync(_path: string): string {
  return _path
}

// Constants
export const constants = {
  F_OK: 0,
  R_OK: 4,
  W_OK: 2,
  X_OK: 1,
}

// Promises API (ba'zi modullar fs.promises ishlatadi)
export const promises = {
  readdir: async (_path: string, _options?: any) => [],
  readFile: async (_path: string, _options?: any) => {
    throw new Error('File not found in polyfill')
  },
  writeFile: async (_path: string, _data: any, _options?: any) => undefined,
  mkdir: async (_path: string, _options?: any) => undefined,
  unlink: async (_path: string) => undefined,
  stat: async (_path: string) => {
    throw new Error('File not found in polyfill')
  },
  access: async (_path: string, _mode?: any) => {
    throw new Error('File not found in polyfill')
  },
}

// Default export
export default {
  readdir,
  readdirSync,
  existsSync,
  readFile,
  readFileSync,
  stat,
  statSync,
  writeFile,
  writeFileSync,
  mkdir,
  mkdirSync,
  unlink,
  unlinkSync,
  access,
  accessSync,
  createReadStream,
  createWriteStream,
  lstat,
  lstatSync,
  realpath,
  realpathSync,
  constants,
  promises,
}
