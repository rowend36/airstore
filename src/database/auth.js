/**
https://firebase.google.com/docs/auth/admin/verify-id-tokens
*/
const jose = require("jose");

// Builds a callback function that makes API calls to the given endpoint
// only once the last response expires, otherwise a fresh call is made.
const buildCachedFetch = (src) => {
  let _cache,
    expiresAt = 0,
    init = async () => {
      const nowMS = Date.now(),
        res = await fetch(src);
      if (!res.ok) {
        const err = new Error("Unexpected response status code: " + res.status);
        err.res = res;
        throw err;
      }
      expiresAt =
        nowMS +
        Number(
          /max-age=(\d+)/.exec(res.headers.get("cache-control") ?? "")?.[1] || 0
        ) *
          1000;
      return res.json();
    },
    refresh = () => {
      expiresAt = 0;
      _cache = init();
      _cache.catch(() => (_cache = null));
      return _cache;
    };

  return (forceRefresh) => {
    return !forceRefresh &&
      _cache &&
      (expiresAt === 0 || expiresAt > Date.now())
      ? _cache
      : refresh();
  };
};

// build the callback to fetch the authentication certificates
const fetchAuthKeyStore = buildCachedFetch(
  "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com"
);

// Defines a callback to pass to the JWT verifier to resolve the appropriate public key
const authKeyResolver = async ({alg, kid}) => {
  const keyStore = await fetchAuthKeyStore();
  if (!(kid in keyStore)) throw new Error("unexpected kid in auth token");
  return jose.importX509(keyStore[kid], alg);
};

// Verifies the Authorization header and returns the decoded ID token. Errors
// will reject the Promise chain.
module.exports = function firebaseAuth(firebaseProjectId) {
  return async (req, res) => {
    const jwt = /^bearer (.*)$/i.exec(req.headers.get("authorization"));

    if (!jwt) return;
    try {
      const result = await jose.jwtVerify(jwt, authKeyResolver, {
        audience: firebaseProjectId,
        issuer: `https://securetoken.google.com/${firebaseProjectId}`,
      });

      result.payload.uid = result.payload.sub; // see https://firebase.google.com/docs/reference/admin/node/firebase-admin.auth.decodedidtoken.md#decodedidtokenuid

      req.auth = result.payload;
    } catch (e) {
      console.error(e);
      return;
    }
  };
};
