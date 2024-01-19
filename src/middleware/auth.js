import { getFirebaseToken } from "@hono/firebase-auth";
import { verifyFirebaseAuth } from "@hono/firebase-auth";

let l;
const firebaseAuth = verifyFirebaseAuth({
  projectId: "csmsuniben",
  firebaseEmulatorHost: "",
  keyStore: {
    get() {
      return l;
    },
    set(e) {
      l = e;
    },
  },
});

export const auth = async (c, next) => {
  try {
    await firebaseAuth(c, function () {
      c.set("auth", getFirebaseToken(c));
    });
  } catch (e) {
    console.log("Unauthenticated Request");
  }
  return await next();
};
