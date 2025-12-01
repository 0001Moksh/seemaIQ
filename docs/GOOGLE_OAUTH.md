Google OAuth Setup

To enable Google Sign-In in development, add the following environment variables to a `.env.local` file at the project root:

- `NEXT_PUBLIC_GOOGLE_CLIENT_ID` - Your Google OAuth client ID (public). This is required for the client SDK.
- `GOOGLE_CLIENT_ID` - Same as above (server-side check).
- `GOOGLE_CLIENT_SECRET` - Your Google OAuth client secret (server-side only).

How to create credentials:
1. Go to Google Cloud Console -> APIs & Services -> Credentials.
2. Create an OAuth 2.0 Client ID (type: Web application).
3. Add `http://localhost:3000` (or your dev host) as an authorized JavaScript origin.
4. Add `http://localhost:3000/api/auth/google` (or adapt) as an authorized redirect URI if implementing redirect flows.
5. Copy the Client ID and Client Secret into `.env.local`.

Example `.env.local`:

NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-public-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_ID=your-public-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret

After setting these, restart your dev server.
