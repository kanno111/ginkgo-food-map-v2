-- 上传进行中与待删除分开，保留现存媒体状态及V1至V5原文。
ALTER TABLE media_files DROP CHECK chk_media_files_state;
ALTER TABLE media_files ADD CONSTRAINT chk_media_files_state CHECK (
    NOT REGEXP_LIKE(status, '[[:space:]]') AND (
      (status = 'UPLOADING' AND expires_at IS NOT NULL AND bound_at IS NULL)
      OR (status = 'TEMPORARY' AND expires_at IS NOT NULL AND bound_at IS NULL)
      OR (status = 'BOUND' AND bound_at IS NOT NULL AND expires_at IS NULL)
      OR status = 'PENDING_DELETE'
    )
);
