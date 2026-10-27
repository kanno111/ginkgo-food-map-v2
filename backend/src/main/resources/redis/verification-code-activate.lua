-- 只有拥有相同 reservationId 的邮件发送流程可以激活预留。
if redis.call('HGET', KEYS[1], 'reservation_id') ~= ARGV[1] then
    return 0
end

redis.call('HSET', KEYS[1], 'active', '1')
return 1
