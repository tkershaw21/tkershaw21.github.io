import { firebaseConfig } from "./firebaseconfig.js";

export async function connectFirebase() {
  const requiredFields = [
    "apiKey",
    "authDomain",
    "databaseURL",
    "projectId",
    "appId"
  ];

  for (const key of requiredFields) {
    if (
      !firebaseConfig[key] ||
      firebaseConfig[key].includes("PASTE_")
    ) {
      throw new Error(
        "Firebase setup is incomplete. Add your web configuration " +
        "to js/firebase-config.js, then reload."
      );
    }
  }

  // Dynamic imports allow the page to show a loading error
  // if Firebase's JavaScript files cannot be reached.
  const [appSDK, authSDK, databaseSDK] = await Promise.all([
    import(
      "https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js"
    ),
    import(
      "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js"
    ),
    import(
      "https://www.gstatic.com/firebasejs/13.1.0/firebase-database.js"
    )
  ]);

  const app = appSDK.initializeApp(firebaseConfig);
  const auth = authSDK.getAuth(app);

  await authSDK.setPersistence(
    auth,
    authSDK.browserLocalPersistence
  );

  return {
    auth,
    db: databaseSDK.getDatabase(app),
    ...authSDK,
    ...databaseSDK
  };
}
