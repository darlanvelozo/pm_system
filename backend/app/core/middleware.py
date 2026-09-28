import time
from collections import defaultdict, deque
from starlette.responses import JSONResponse


class SecurityMiddleware:
    def __init__(self, app):
        self.app = app
        self.hits = defaultdict(deque)

    async def __call__(self, scope, receive, send):
        if scope['type'] != 'http':
            return await self.app(scope, receive, send)
        path = scope['path']
        ip = (scope.get('client') or ('unknown',))[0]
        login = path == '/api/auth/login'
        key = (ip, login)
        current = time.monotonic()
        # Periodic global eviction prevents unbounded key growth.
        if len(self.hits) > 10000:
            self.hits = defaultdict(deque, {k:v for k,v in self.hits.items() if v and v[-1] > current-60})
        entries = self.hits[key]
        while entries and entries[0] <= current-60:
            entries.popleft()
        if len(entries) >= (10 if login else 180):
            return await JSONResponse({'detail': 'Muitas tentativas. Aguarde um minuto.'}, 429, headers={'Retry-After': '60'})(scope, receive, send)
        entries.append(current)
        size = 0
        messages = []
        while True:
            message = await receive()
            if message['type'] == 'http.disconnect':
                return
            size += len(message.get('body', b''))
            if size > 256 * 1024:
                return await JSONResponse({'detail': 'Conteúdo excede 256 KiB'}, 413)(scope, receive, send)
            messages.append(message)
            if not message.get('more_body'):
                break

        async def replay():
            if messages:
                return messages.pop(0)
            return await receive()

        async def secure_send(message):
            if message['type'] == 'http.response.start':
                message.setdefault('headers', []).extend([(b'cache-control', b'no-store'), (b'x-content-type-options', b'nosniff'), (b'x-frame-options', b'DENY'), (b'referrer-policy', b'no-referrer')])
            await send(message)

        await self.app(scope, replay, secure_send)
