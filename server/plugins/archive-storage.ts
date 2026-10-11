import fsLiteDriver from 'unstorage/drivers/fs-lite'
import s3Driver from 'unstorage/drivers/s3'

/**
 * "archive" storage: everything fetched from DGT (photos, orthophoto tiles) is
 * stored here once and served from here afterwards.
 *   - S3 (or any S3-compatible: R2, MinIO, B2…) when NUXT_S3_BUCKET is set
 *   - local disk (.data/archive) otherwise
 */
export default defineNitroPlugin(() => {
  const s3 = useRuntimeConfig().s3
  const driver = s3.bucket
    ? s3Driver({
        bucket: s3.bucket,
        region: s3.region || 'auto',
        endpoint: s3.endpoint || `https://s3.${s3.region}.amazonaws.com`,
        accessKeyId: s3.accessKeyId,
        secretAccessKey: s3.secretAccessKey,
      })
    : fsLiteDriver({ base: './.data/archive' })
  useStorage().mount('archive', driver)
  console.info(`[archive] storing fetched imagery in ${s3.bucket ? `s3://${s3.bucket}` : '.data/archive'}`)
})
