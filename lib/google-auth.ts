// Initialize Google Sign-In
export const initializeGoogleSignIn = () => {
  if (typeof window !== 'undefined') {
    if (!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID) {
      console.warn('NEXT_PUBLIC_GOOGLE_CLIENT_ID is not set. Google Sign-In will be disabled.')
      return;
    }
    // Check if script is already loaded
    if ((window as any).google?.accounts?.id) {
      return;
    }

    // Load Google Identity Services script and return a promise when ready
    if (!(window as any).__gsiLoading) {
      (window as any).__gsiLoading = new Promise<void>((resolve) => {
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = () => resolve();
        document.head.appendChild(script);
      });
    }
  }
};

// Initialize Google Sign-In button
export const renderGoogleSignInButton = (elementId: string, onSuccess: (credentialResponse: any) => void) => {
  if (typeof window === 'undefined') return;

  const ensureRender = async () => {
    if (!(window as any).google?.accounts?.id) {
      await (window as any).__gsiLoading;
    }

    if (!(window as any).google?.accounts?.id) return;

    try {
      (window as any).google.accounts.id.initialize({
        client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
        callback: onSuccess,
      });

      (window as any).google.accounts.id.renderButton(
        document.getElementById(elementId),
        {
          theme: 'outline',
          size: 'large',
          width: '100%',
          text: 'signin_with',
        }
      );
    } catch (e) {
      console.error('Error rendering Google Sign-In button', e);
    }
  };

  // Fire and forget
  ensureRender();
};

// Handle Google Sign-In response
export const handleGoogleSignIn = async (credentialResponse: any) => {
  const token = credentialResponse.credential;

  const response = await fetch('/api/auth/google', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });

  return await response.json();
};
