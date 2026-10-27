-- 原子检查冷却与单邮箱小时/24小时配额，然后创建尚未激活的验证码预留。
-- KEYS: code, cooldown, email-hour, email-day
-- ARGV: digest, reservationId, codeTtlMs, cooldownTtlMs, 两类上限, hourTtlMs, dayTtlMs
if redis.call('EXISTS', KEYS[2]) == 1 then
    return -1
end

local counters = {
    { key = KEYS[3], limit = tonumber(ARGV[5]), rejected = -2, ttl = tonumber(ARGV[7]) },
    { key = KEYS[4], limit = tonumber(ARGV[6]), rejected = -3, ttl = tonumber(ARGV[8]) }
}

for _, counter in ipairs(counters) do
    local current = tonumber(redis.call('GET', counter.key) or '0')
    if current >= counter.limit then
        return counter.rejected
    end
end

for _, counter in ipairs(counters) do
    local current = redis.call('INCR', counter.key)
    if current == 1 then
        redis.call('PEXPIRE', counter.key, counter.ttl)
    end
end

redis.call('SET', KEYS[2], ARGV[2], 'PX', ARGV[4])
-- 使用 HMSET 兼容本地旧版 Redis；该命令在新版本仍保留兼容，不影响原子性。
redis.call('HMSET', KEYS[1],
        'digest', ARGV[1],
        'attempts', '0',
        'active', '0',
        'reservation_id', ARGV[2])
redis.call('PEXPIRE', KEYS[1], ARGV[3])
return 1
