import {
    createUserWithEmailAndPassword,
    onAuthStateChanged,
    signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { auth } from "./firebase-config.js";

const authElements = {
    form: document.getElementById("auth-form"),
    title: document.getElementById("auth-title"),
    subtitle: document.getElementById("auth-subtitle"),
    submit: document.getElementById("auth-submit"),
    toggle: document.getElementById("toggle-link"),
    toggleText: document.getElementById("auth-toggle-text"),
    container: document.getElementById("auth-container"),
    toast: document.getElementById("toast")
};

let isLoginMode = true;

function showAuthToast(message, type = "info") {
    authElements.toast.textContent = message;
    authElements.toast.className = `toast show ${type}`;
    setTimeout(() => {
        authElements.toast.className = "toast";
    }, 3500);
}

function setAuthMode(nextMode) {
    isLoginMode = nextMode === "login";
    authElements.title.textContent = isLoginMode ? "Iniciar sesion" : "Crear cuenta";
    authElements.subtitle.textContent = isLoginMode
        ? "Accede a tu tablero financiero privado."
        : "Crea una cuenta para guardar tus movimientos.";
    authElements.submit.textContent = isLoginMode ? "Entrar" : "Crear cuenta";
    authElements.toggleText.textContent = isLoginMode ? "No tienes cuenta?" : "Ya tienes cuenta?";
    authElements.toggle.textContent = isLoginMode ? "Registrarse" : "Volver al login";
}

function mapAuthError(errorCode) {
    const messages = {
        "auth/invalid-credential": "Credenciales invalidas.",
        "auth/email-already-in-use": "Ese correo ya esta registrado.",
        "auth/invalid-email": "Revisa el formato del correo.",
        "auth/too-many-requests": "Demasiados intentos. Intenta mas tarde.",
        "auth/weak-password": "La contrasena debe tener al menos 6 caracteres."
    };

    return messages[errorCode] || "No se pudo completar la autenticacion.";
}

authElements.toggle.addEventListener("click", (event) => {
    event.preventDefault();
    setAuthMode(isLoginMode ? "register" : "login");
});

authElements.form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    authElements.submit.disabled = true;
    authElements.submit.textContent = isLoginMode ? "Verificando..." : "Creando...";

    try {
        if (isLoginMode) {
            await signInWithEmailAndPassword(auth, email, password);
            showAuthToast("Sesion iniciada.");
        } else {
            await createUserWithEmailAndPassword(auth, email, password);
            showAuthToast("Cuenta creada.");
        }
    } catch (error) {
        showAuthToast(mapAuthError(error.code), "error");
    } finally {
        authElements.submit.disabled = false;
        authElements.submit.textContent = isLoginMode ? "Entrar" : "Crear cuenta";
    }
});

onAuthStateChanged(auth, (user) => {
    if (user) {
        authElements.container.classList.add("hidden");
        return;
    }

    authElements.container.classList.remove("hidden");
    authElements.form.reset();
});

setAuthMode("login");
