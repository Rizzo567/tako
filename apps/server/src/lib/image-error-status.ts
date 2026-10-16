/** Separate user input errors from temporary backend failures so clients can retry. */
export function imageErrorStatus(code:string):number {
 if(code==='STORAGE_FULL')return 507
 if(code==='INPUT_BYTE_LIMIT')return 413
 if(code==='INPUT_PIXEL_LIMIT')return 422
 if(code==='ANIMATION_NOT_SUPPORTED')return 415
 if(code.startsWith('EDGE_')||code.startsWith('IMAGE_QUOTA_')||code==='IMAGE_CODEC_BUSY'||code==='WRITE_FAILED')return 503
 return 400
}
