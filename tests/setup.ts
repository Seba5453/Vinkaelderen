import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'
import { Blob as NodeBlob, File as NodeFile } from 'node:buffer'

// jsdom's Blob lacks arrayBuffer()/text(); real browsers have them. Use Node's spec-compliant ones.
Object.assign(globalThis, { Blob: NodeBlob, File: NodeFile })
if (typeof window !== 'undefined') Object.assign(window, { Blob: NodeBlob, File: NodeFile })

// Vitest's jsdom createObjectURL can't read Node Blobs; pages only need a URL string.
let urlCounter = 0
URL.createObjectURL = () => `blob:test/${++urlCounter}`
URL.revokeObjectURL = () => {}
