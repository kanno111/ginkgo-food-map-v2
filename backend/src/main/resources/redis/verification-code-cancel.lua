-- 邮件失败只能取消仍处于 pending 且属于本次 reservationId 的预留。
if redis.call('HGET', KEYS[1], 'reservation_id') ~= ARGV[1] then
    return 0
end
if redis.call('HGET', KEYS[1], 'active') ~= '0' then
    return 0
end

redis.call('DEL', KEYS[1])
if redis.call('GET', KEYS[2]) == ARGV[1] then
    redis.call('DEL', KEYS[2])
end
return 1
