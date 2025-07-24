import { NextResponse } from "next/server"

export async function GET() {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>OAuth Test</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 40px; }
        .container { max-width: 600px; margin: 0 auto; }
        .status { padding: 20px; margin: 20px 0; border-radius: 8px; }
        .info { background: #e3f2fd; color: #1976d2; }
        .warning { background: #fff3cd; color: #856404; }
        .success { background: #d4edda; color: #155724; }
        button { padding: 10px 20px; font-size: 16px; cursor: pointer; }
        pre { background: #f5f5f5; padding: 10px; overflow-x: auto; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Google OAuth Test</h1>
        
        <div class="status info">
          <h3>Current Configuration</h3>
          <pre>
Server Port: ${process.env.PORT || '3003'}
NEXTAUTH_URL: ${process.env.NEXTAUTH_URL}
Callback URL: ${process.env.NEXTAUTH_URL}/api/auth/callback/google
          </pre>
        </div>
        
        <div class="status warning">
          <h3>Important!</h3>
          <p>Make sure your Google OAuth app includes this redirect URI:</p>
          <code>${process.env.NEXTAUTH_URL}/api/auth/callback/google</code>
        </div>
        
        <h3>Test Authentication</h3>
        <button onclick="testAuth()">Sign in with Google</button>
        
        <div id="log" style="margin-top: 20px;"></div>
        
        <script>
          function log(message, type = 'info') {
            const logDiv = document.getElementById('log');
            const entry = document.createElement('div');
            entry.className = 'status ' + type;
            entry.innerHTML = '<strong>' + new Date().toLocaleTimeString() + '</strong>: ' + message;
            logDiv.appendChild(entry);
          }
          
          async function testAuth() {
            log('Starting authentication flow...');
            
            // Open auth window
            const width = 500;
            const height = 600;
            const left = window.screenX + (window.outerWidth - width) / 2;
            const top = window.screenY + (window.outerHeight - height) / 2;
            
            const authWindow = window.open(
              '/api/auth/signin/google',
              'google-auth',
              \`width=\${width},height=\${height},left=\${left},top=\${top}\`
            );
            
            // Monitor the auth window
            const checkInterval = setInterval(async () => {
              try {
                if (authWindow.closed) {
                  clearInterval(checkInterval);
                  log('Auth window closed, checking session...');
                  
                  const response = await fetch('/api/auth/session');
                  const session = await response.json();
                  
                  if (session.user) {
                    log('Authentication successful! User: ' + session.user.email, 'success');
                    setTimeout(() => {
                      window.location.href = '/dashboard';
                    }, 2000);
                  } else {
                    log('No session found. Authentication may have failed.', 'warning');
                  }
                }
              } catch (e) {
                // Window is still open or cross-origin
              }
            }, 1000);
          }
        </script>
      </div>
    </body>
    </html>
  `
  
  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html',
    },
  })
}