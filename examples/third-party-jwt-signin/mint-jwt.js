/**
 * Third-party JWT sign-in (Option B — "Shadow Users"), Node.js version.
 * See mint-jwt.php for the full explanation; this is the same flow.
 *
 * Run with:
 *   npm install jsonwebtoken
 *   QL_PROVIDER_ID=acme-corp QL_JWT_SECRET=... node mint-jwt.js
 */

const jwt = require('jsonwebtoken');

const PROVIDER_ID = process.env.QL_PROVIDER_ID || 'acme-corp'; // matches ql_auth_providers.id
const JWT_SECRET = process.env.QL_JWT_SECRET || 'change-me'; // matches ql_auth_providers.jwt_secret

function mintQLJwt(user) {
  return jwt.sign(
    {
      sub: user.id, // stable unique ID in your system
      email: user.email,
      first_name: user.firstName,
      last_name: user.lastName,
    },
    JWT_SECRET,
    { algorithm: 'HS256', keyid: PROVIDER_ID, expiresIn: '1h' }
  );
}

async function exchangeForSessionToken(qlBase, signedJwt) {
  const res = await fetch(`${qlBase}/wp-admin/admin-ajax.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ action: 'ql_third_party_signin', jwt: signedJwt }),
  });
  const json = await res.json();
  if (!json.success) {
    throw new Error('ql_third_party_signin failed: ' + (json.data && json.data.message));
  }
  return json.data; // { session_token, user }
}

async function main() {
  const signedJwt = mintQLJwt({
    id: 'user-123',
    email: 'jane@example.com',
    firstName: 'Jane',
    lastName: 'Doe',
  });

  const { session_token, user } = await exchangeForSessionToken('https://quantumlayers.com', signedJwt);
  console.log('QL session token:', session_token);
  console.log('Signed in as:', user.email);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
