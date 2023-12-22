const { getFirebaseToken } = require("@hono/firebase-auth");
const { verifyFirebaseAuth } = require("@hono/firebase-auth");

let l;
const auth = verifyFirebaseAuth({
  projectId: "csmsuniben",
  keyStore: {
    get() {
      return l;
    },
    set(e) {
      l = e;
    },
  },
});

exports.auth = async (c, next) => {
  try {
    await auth(c, function () {
      c.set("auth", getFirebaseToken(c));
    });
  } catch (e) {
    console.log("Unauthenticated Request");
  }
  return await next();
};
