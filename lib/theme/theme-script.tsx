/**
 * Theme initialization script for SSR
 * Prevents flash of unstyled content (FOUC) by setting theme before first paint
 */

export function ThemeScript() {
  // This script runs before React hydration to prevent theme flashing
  const themeScript = `
    (function() {
      const STORAGE_KEY = 'ucd-theme';
      const VALID_THEMES = ['light', 'dark', 'system'];
      
      function getSystemTheme() {
        try {
          return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        } catch (e) {
          return 'light'; // Fallback for old browsers
        }
      }
      
      function setThemeAttributes(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        document.documentElement.classList.remove('light', 'dark');
        document.documentElement.classList.add(theme);
        document.documentElement.style.colorScheme = theme;
      }
      
      try {
        // Try to get theme from localStorage
        const storedTheme = localStorage.getItem(STORAGE_KEY);
        let theme = VALID_THEMES.includes(storedTheme) ? storedTheme : 'system';
        
        // Resolve system theme to actual theme
        const resolvedTheme = theme === 'system' ? getSystemTheme() : theme;
        
        // Apply theme immediately
        setThemeAttributes(resolvedTheme);
        
        // Listen for system theme changes if using system preference
        if (theme === 'system') {
          try {
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(e) {
              const newTheme = e.matches ? 'dark' : 'light';
              setThemeAttributes(newTheme);
            });
          } catch (e) {
            // Fallback for browsers that don't support addEventListener on matchMedia
          }
        }
        
        // Store theme info for telemetry
        window.__themeData = {
          theme: theme,
          resolved: resolvedTheme,
          storageAvailable: true,
          systemPreference: getSystemTheme()
        };
        
      } catch (e) {
        // localStorage is blocked (e.g., private browsing)
        const fallbackTheme = getSystemTheme();
        setThemeAttributes(fallbackTheme);
        
        // Store error info for telemetry
        window.__themeData = {
          theme: 'system',
          resolved: fallbackTheme,
          storageAvailable: false,
          storageError: e.message,
          systemPreference: fallbackTheme
        };
      }
    })();
  `.trim()

  return <script dangerouslySetInnerHTML={{ __html: themeScript }} />
}

/**
 * NoFlashScript - Alternative implementation with nonce support for CSP
 */
export function NoFlashScript({ nonce }: { nonce?: string }) {
  const themeScript = `
    (function() {
      try {
        const theme = localStorage.getItem('ucd-theme') || 'system';
        const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        const activeTheme = theme === 'system' ? systemTheme : theme;
        document.documentElement.setAttribute('data-theme', activeTheme);
        document.documentElement.classList.add(activeTheme);
      } catch (e) {}
    })();
  `

  return <script nonce={nonce} dangerouslySetInnerHTML={{ __html: themeScript }} />
}
