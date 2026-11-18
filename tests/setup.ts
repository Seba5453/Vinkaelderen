import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'
import { Blob as NodeBlob, File as NodeFile } from 'node:buffer'

// jsdom's Blob lacks arrayBuffer()/text(); real browsers have them. Use Node's spec-compliant ones.
Object.assign(globalThis, { Blob: NodeBlob, File: NodeFile })
if (typeof window !== 'undefined') Object.assign(window, { Blob: NodeBlob, File: NodeFile })
