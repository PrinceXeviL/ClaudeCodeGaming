# Profil sunucusu (test): oyunu Document-Policy: js-profiling başlığıyla sunar; tarayıcıda JS Self-Profiling API
# (new Profiler) ile kalabalıktaki takılmaların hangi fonksiyondan geldiği ölçülür. Kullanım: python3 profil_sunucu.py <port> <klasör>
import sys, functools, http.server
class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Document-Policy', 'js-profiling')
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()
port, root = int(sys.argv[1]), sys.argv[2]
http.server.ThreadingHTTPServer(('127.0.0.1', port), functools.partial(H, directory=root)).serve_forever()
