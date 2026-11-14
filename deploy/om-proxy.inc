# Shared settings for the /api/om/* caching proxy locations (included from nginx.conf).
# Mounted at /etc/nginx/om-proxy.inc (outside conf.d/, so it is never loaded on its own).

proxy_ssl_server_name on;
proxy_http_version 1.1;
proxy_set_header Connection "";
proxy_set_header Accept-Encoding "";      # cache uncompressed; nginx gzips towards the client

proxy_cache om;
proxy_cache_key $uri$is_args$args;
proxy_cache_valid 400 404 1m;            # bad parameters – don't hammer the API with them
proxy_ignore_headers Cache-Control Expires Set-Cookie Vary;
proxy_hide_header Set-Cookie;
proxy_cache_lock on;                      # many simultaneous visitors → one upstream request
proxy_cache_lock_timeout 15s;
proxy_cache_background_update on;
# When Open-Meteo is unreachable or rate-limits us (429), serve the last good answer instead.
proxy_cache_use_stale error timeout updating http_429 http_500 http_502 http_503 http_504;

proxy_ssl_session_reuse on;
proxy_connect_timeout 15s;
proxy_read_timeout 60s;                   # long archive ranges take a while

add_header X-Cache-Status $upstream_cache_status always;
add_header Cache-Control "no-store" always;
add_header X-Content-Type-Options "nosniff" always;
