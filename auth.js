// auth.js
import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { auth } from "./firebase-config.js";

const authElements = {
    form: document.getElementById('auth-form'),
    title: document.getElementById('auth-title'),
    submit: document.getElementById('auth-submit'),
    toggle: document.getElementById('toggle-link'),
    container: document.getElementById('auth-container'),
    toast: document.getElementById('toast')
};

let isLoginMode = true;

function showAuthToast(msg, type = 'success') {
    let prefix = type === 'error' ? '[ERROR]' : '[INFO]';
    authElements.toast.innerText = `${prefix} ${msg}`;
    authElements.toast.className = `toast show ${type}`;
    setTimeout(() => authElements.toast.className = 'toast', 3500);
}

// Cambiar entre Login y Registro
authElements.toggle.addEventListener('click', (e) => {
    e.preventDefault();
    isLoginMode = !isLoginMode;
    
    authElements.title.innerHTML = isLoginMode ? 'Elzuco_ing <span class="text-blue-500 font-mono">FINANZAS</span>' : 'NUEVO <span class="text-blue-500 font-mono">USUARIO</span>';
    authElements.submit.innerText = isLoginMode ? 'Iniciar Sesión' : 'Crear Cuenta';
    
    document.getElementById('auth-toggle-container').innerHTML = isLoginMode 
        ? '¿No tienes cuenta? <a href="#" id="toggle-link" class="text-blue-400 hover:text-blue-300 underline underline-offset-4 decoration-blue-500/30">Registrarse</a>'
        : '¿Ya tienes cuenta? <a href="#" id="toggle-link" class="text-blue-400 hover:text-blue-300 underline underline-offset-4 decoration-blue-500/30">Volver al Login</a>';
    
    document.getElementById('toggle-link').addEventListener('click', (ev) => {
        ev.preventDefault();
        authElements.toggle.click();
    });
});

// Enviar Formulario
authElements.form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const pass = document.getElementById('password').value;

    authElements.submit.disabled = true;
    authElements.submit.innerText = 'Verificando...';

    try {
        if (isLoginMode) {
            await signInWithEmailAndPassword(auth, email, pass);
            showAuthToast('Acceso Concedido');
        } else {
            await createUserWithEmailAndPassword(auth, email, pass);
            showAuthToast('Usuario Registrado Exitosamente');
        }
    } catch (err) {
        let errorMsg = "Error de Autenticación";
        if (err.code === 'auth/invalid-credential') errorMsg = "Credenciales Inválidas";
        if (err.code === 'auth/email-already-in-use') errorMsg = "El correo ya está registrado";
        if (err.code === 'auth/weak-password') errorMsg = "La contraseña es muy débil";
        showAuthToast(errorMsg, 'error');
    } finally {
        authElements.submit.disabled = false;
        authElements.submit.innerText = isLoginMode ? 'Iniciar Sesión' : 'Crear Cuenta';
    }
});

// Vigilar estado de la sesión
onAuthStateChanged(auth, (user) => {
    if (user) authElements.container.classList.add('hidden');
    else {
        authElements.container.classList.remove('hidden');
        authElements.form.reset();
    }
});