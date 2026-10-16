import {expect,it} from 'vitest'
import {imageErrorStatus} from '../apps/server/src/lib/image-error-status.js'
it('upload status distinguishes retries from rejected user files',()=>{expect(imageErrorStatus('IMAGE_QUOTA_UNAVAILABLE')).toBe(503);expect(imageErrorStatus('EDGE_CODEC_REQUIRED')).toBe(503);expect(imageErrorStatus('STORAGE_FULL')).toBe(507);expect(imageErrorStatus('INPUT_BYTE_LIMIT')).toBe(413);expect(imageErrorStatus('INPUT_PIXEL_LIMIT')).toBe(422);expect(imageErrorStatus('ANIMATION_NOT_SUPPORTED')).toBe(415);expect(imageErrorStatus('INVALID_FILE_CONTENT')).toBe(400)})
