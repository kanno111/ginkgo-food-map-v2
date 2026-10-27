-- 校验、失败次数递增和成功删除必须在同一 Lua 中完成，防止并发重复消费。
if redis.call('EXISTS', KEYS[1]) == 0 then
    return 0
end
if redis.call('HGET', KEYS[1], 'active') ~= '1' then
    return 0
end

if redis.call('HGET', KEYS[1], 'digest') == ARGV[1] then
    redis.call('DEL', KEYS[1])
    return 1
end

local attempts = redis.call('HINCRBY', KEYS[1], 'attempts', 1)
if attempts >= tonumber(ARGV[2]) then
    redis.call('DEL', KEYS[1])
    return -2
end
return -1
