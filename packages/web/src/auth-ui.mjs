import { apiClient } from "./api-client.mjs";

export function initAuthUI({ $, onAuthenticated, onSignedOut }) {
  let mode = "login";
  const authView = $("auth-view");
  const appView = $("app-view");
  const authForm = $("auth-form");
  const authErr = $("auth-error");
  const nameField = $("auth-name-field");
  const submitBtn = $("auth-submit-btn");
  const tabLogin = $("tab-login");
  const tabRegister = $("tab-register");

  function setMode(next) {
    mode = next;
    authErr.classList.add("hidden");
    const isReg = mode === "register";
    nameField.classList.toggle("hidden", !isReg);
    authForm.elements.name.required = isReg;
    submitBtn.textContent = isReg ? "Criar conta" : "Entrar";
    tabLogin.className = isReg ? "btn-ghost" : "btn-primary";
    tabRegister.className = isReg ? "btn-primary" : "btn-ghost";
  }

  function showAuth(message) {
    appView.classList.add("hidden");
    authView.classList.remove("hidden");
    if (message) {
      authErr.textContent = message;
      authErr.classList.remove("hidden");
    } else {
      authErr.classList.add("hidden");
    }
  }

  function showApp(user) {
    authView.classList.add("hidden");
    appView.classList.remove("hidden");
    $("user-name").textContent = user.name;
    onAuthenticated(user);
  }

  tabLogin.addEventListener("click", () => setMode("login"));
  tabRegister.addEventListener("click", () => setMode("register"));

  authForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    authErr.classList.add("hidden");
    const data = new FormData(authForm);
    try {
      const payload = {
        email: data.get("email"),
        password: data.get("password")
      };
      const sess =
        mode === "register"
          ? await apiClient.register({ ...payload, name: data.get("name") })
          : await apiClient.login(payload);
      authForm.reset();
      showApp(sess.user);
    } catch (err) {
      authErr.textContent = err.message;
      authErr.classList.remove("hidden");
    }
  });

  $("logout-btn").addEventListener("click", async () => {
    try {
      await apiClient.logout();
    } finally {
      onSignedOut();
      showAuth();
    }
  });

  async function bootstrap() {
    try {
      const { user } = await apiClient.me();
      showApp(user);
    } catch {
      showAuth();
    }
  }

  setMode("login");
  return { bootstrap, showAuth };
}
