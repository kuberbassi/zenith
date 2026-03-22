import gzip
from flask import request

def init_compression(app):
    @app.after_request
    def compress(response):
        accept_encoding = request.headers.get('Accept-Encoding', '')
        
        if 'gzip' not in accept_encoding.lower():
            return response
            
        if response.status_code < 200 or response.status_code >= 300 or \
           'Content-Encoding' in response.headers or \
           'gzip' not in accept_encoding.lower():
            return response
            
        # Compress responses larger than 1KB
        if response.direct_passthrough or len(response.data) < 1024:
            return response
            
        response.data = gzip.compress(response.data)
        response.headers['Content-Encoding'] = 'gzip'
        response.headers['Vary'] = 'Accept-Encoding'
        response.headers['Content-Length'] = len(response.data)
        
        return response
